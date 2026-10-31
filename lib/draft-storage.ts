import type {
  CandidateKind,
  CharacterCountMode,
  GeneratedCandidate,
  GenerationMode,
  ProtectedExpression,
  ProtectedExpressionCategory,
  SemanticRisk,
  WorkDraft,
  WorkStep,
} from './contracts';

const workSteps = new Set<WorkStep>(['input', 'protect', 'compare']);
const countModes = new Set<CharacterCountMode>(['include-whitespace', 'exclude-whitespace']);
const generationModes = new Set<GenerationMode>(['generate', 'reconcile']);
const candidateKinds = new Set<CandidateKind>(['aggressive', 'balanced', 'preserve']);
const semanticRisks = new Set<SemanticRisk>(['maintained', 'weakened', 'heavily-weakened']);
const protectedCategories = new Set<ProtectedExpressionCategory>([
  'effort',
  'initiative',
  'specific-number',
  'failure-recovery',
  'unique-expression',
]);

export class DraftValidationError extends Error {}

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DraftValidationError('저장할 글의 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maximum);
}

function stringList(value: unknown, maximumItems = 20): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, maximumItems).map((item) => item.slice(0, 500))
    : [];
}

function normalizeProtectedExpressions(value: unknown, originalText: string): ProtectedExpression[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const start = Number(item.start);
    const end = Number(item.end);
    const category = item.category as ProtectedExpressionCategory;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > originalText.length) return [];
    if (!protectedCategories.has(category) || originalText.slice(start, end) !== item.text) return [];
    return [{
      id: typeof item.id === 'string' && item.id.length <= 100 ? item.id : crypto.randomUUID(),
      text: originalText.slice(start, end),
      start,
      end,
      category,
    }];
  });
}

function normalizeCandidates(value: unknown): GeneratedCandidate[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const analysis = item.analysis && typeof item.analysis === 'object' ? item.analysis as Record<string, unknown> : null;
    const kind = item.kind as CandidateKind;
    const semanticRisk = analysis?.semanticRisk as SemanticRisk;
    if (typeof item.text !== 'string' || item.text.length > 20_000 || !candidateKinds.has(kind) || !semanticRisks.has(semanticRisk)) return [];

    const protectedReplacements = Array.isArray(item.protectedReplacements)
      ? item.protectedReplacements.flatMap((replacement) => {
          if (!replacement || typeof replacement !== 'object') return [];
          const pair = replacement as Record<string, unknown>;
          return typeof pair.token === 'string' && typeof pair.text === 'string'
            ? [{ token: pair.token.slice(0, 100), text: pair.text.slice(0, 2_000) }]
            : [];
        }).slice(0, 100)
      : undefined;

    return [{
      id: typeof item.id === 'string' && item.id.length <= 150 ? item.id : crypto.randomUUID(),
      kind,
      text: item.text,
      analysis: {
        semanticRisk,
        evidence: stringList(analysis?.evidence),
        naturalnessWarnings: stringList(analysis?.naturalnessWarnings),
        protectedExpressionChanges: stringList(analysis?.protectedExpressionChanges),
      },
      protectedReplacements,
    }];
  });
}

export function normalizeWorkDraft(value: unknown): WorkDraft {
  const input = recordOf(value);
  const originalText = text(input.originalText, 20_000);
  const targetLength = Number(input.targetLength);
  if (!Number.isInteger(targetLength) || targetLength < 1 || targetLength > 10_000) {
    throw new DraftValidationError('목표 글자 수는 1자 이상 10,000자 이하여야 합니다.');
  }

  const countMode = input.countMode as CharacterCountMode;
  const currentStep = input.currentStep as WorkStep;
  const comparisonMode = input.comparisonMode as GenerationMode;

  return {
    title: text(input.title, 100, '제목 없는 글').trim() || '제목 없는 글',
    originalText,
    targetLength,
    countMode: countModes.has(countMode) ? countMode : 'include-whitespace',
    protectedExpressions: normalizeProtectedExpressions(input.protectedExpressions, originalText),
    currentStep: workSteps.has(currentStep) ? currentStep : 'input',
    comparisonMode: generationModes.has(comparisonMode) ? comparisonMode : 'generate',
    revisedText: text(input.revisedText, 20_000),
    candidates: normalizeCandidates(input.candidates),
    manualVersion: text(input.manualVersion, 100),
    selectedCandidateId: typeof input.selectedCandidateId === 'string' ? input.selectedCandidateId.slice(0, 150) : null,
    finalText: typeof input.finalText === 'string' ? input.finalText.slice(0, 20_000) : null,
  };
}
