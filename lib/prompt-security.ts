export type PromptInjectionReason =
  | 'hidden-control'
  | 'instruction-override'
  | 'prompt-exfiltration'
  | 'role-spoofing'
  | 'delimiter-injection'
  | 'encoded-instruction'
  | 'unsafe-output';

export interface PromptSecurityFinding {
  reasons: PromptInjectionReason[];
}

const hiddenControlPattern = /[\u200B\u200C\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu;
const delimiterPattern = /<\/?(?:system|assistant|developer|original|previous_version|current_version|previous_candidates|validation_issues)(?:\s[^>]*)?>|\[\/?INST\]|<<\/?SYS>>/iu;
const roleSpoofingPattern = /(?:^|\n)\s*(?:system|assistant|developer)\s*:/imu;
const overridePatterns = [
  /(?:ignore|disregard|forget|override|bypass)\b.{0,60}\b(?:previous|prior|above|all|system|developer)?\s*(?:instructions?|prompts?|rules?)/iu,
  /(?:instructions?|prompts?|rules?)\b.{0,60}\b(?:ignore|disregard|forget|override|bypass)/iu,
  /(?:이전|위|앞선|기존|모든).{0,20}(?:지시|명령|프롬프트|규칙).{0,30}(?:무시|잊|따르지|덮어|우회|해제)/u,
  /(?:지시|명령|프롬프트|규칙).{0,30}(?:무시|잊|따르지|덮어|우회|해제)/u,
];
const exfiltrationPatterns = [
  /(?:reveal|show|print|copy|repeat|expose)\b.{0,60}\b(?:system|developer)\s*(?:prompt|instructions?)/iu,
  /(?:system|developer)\s*(?:prompt|instructions?)\b.{0,60}\b(?:reveal|show|print|copy|repeat|expose)/iu,
  /(?:시스템|개발자).{0,15}(?:프롬프트|지시|명령).{0,30}(?:공개|출력|복사|보여|말해|노출)/u,
  /(?:공개|출력|복사|보여|말해|노출).{0,30}(?:시스템|개발자).{0,15}(?:프롬프트|지시|명령)/u,
];
const compactOverridePatterns = [
  /ignoreall(?:previous|prior|above)instructions?/u,
  /disregardall(?:previous|prior|above)instructions?/u,
  /이전(?:의)?(?:모든)?(?:지시|명령|프롬프트)(?:을|를)?무시/u,
];
const unsafeOutputPatterns = [
  /(?:중요 규칙|반환 형식|자기소개서 편집 매뉴얼|SYSTEM_INSTRUCTIONS|USER_DATA_TO_PROCESS)\s*:/iu,
  /(?:javascript\s*:|<\s*script\b|<\s*iframe\b|<\s*img\b[^>]*\bonerror\s*=)/iu,
  /https?:\/\/[^\s)\]]+/iu,
];

function normalizeForInspection(text: string): string {
  return text.normalize('NFKC').replace(hiddenControlPattern, '').replace(/\s+/gu, ' ').trim();
}

function containsInstructionPattern(text: string): PromptInjectionReason[] {
  const normalized = normalizeForInspection(text);
  const compact = normalized.toLowerCase().replace(/[\s._-]+/gu, '');
  const reasons: PromptInjectionReason[] = [];
  if (overridePatterns.some((pattern) => pattern.test(normalized)) || compactOverridePatterns.some((pattern) => pattern.test(compact))) {
    reasons.push('instruction-override');
  }
  if (exfiltrationPatterns.some((pattern) => pattern.test(normalized))) reasons.push('prompt-exfiltration');
  if (roleSpoofingPattern.test(normalized)) reasons.push('role-spoofing');
  if (delimiterPattern.test(normalized)) reasons.push('delimiter-injection');
  return reasons;
}

function decodeBase64Candidate(value: string): string | null {
  try {
    const standard = value.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function inspectPromptInjection(texts: string[]): PromptSecurityFinding {
  const reasons = new Set<PromptInjectionReason>();
  for (const text of texts) {
    if (hiddenControlPattern.test(text)) reasons.add('hidden-control');
    hiddenControlPattern.lastIndex = 0;
    containsInstructionPattern(text).forEach((reason) => reasons.add(reason));

    for (const match of text.matchAll(/(?:^|[^A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{24,}={0,2})(?=$|[^A-Za-z0-9+/_=-])/gu)) {
      const decoded = decodeBase64Candidate(match[1]);
      if (decoded && containsInstructionPattern(decoded).length > 0) reasons.add('encoded-instruction');
    }
  }
  return { reasons: [...reasons] };
}

export function inspectModelOutput(texts: string[]): PromptSecurityFinding {
  const reasons = new Set<PromptInjectionReason>(inspectPromptInjection(texts).reasons);
  if (texts.some((text) => unsafeOutputPatterns.some((pattern) => pattern.test(text)))) reasons.add('unsafe-output');
  return { reasons: [...reasons] };
}
