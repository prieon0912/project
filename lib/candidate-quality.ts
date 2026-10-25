import type { CandidateKind, CharacterCountMode } from './contracts.ts';
import { countCharacters } from './text-count.ts';

export interface CandidateQualityInput {
  kind: CandidateKind;
  text: string;
  sourceText: string;
  targetLength: number;
  countMode: CharacterCountMode;
}

export interface CandidateQualityIssue {
  code: 'too-long' | 'too-short' | 'number-added' | 'number-removed' | 'cliche-added' | 'unfinished';
  message: string;
}

const bannedCliches = [
  '값진 경험',
  '한 단계 성장',
  '협업의 중요성',
  '역량을 함양',
  '열정과 끈기',
  '문제 해결 능력을 발휘',
  '소중한 교훈',
  '몸소 깨달았습니다',
  '미래 인재',
];

function extractNumbers(text: string): string[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)*(?:%|명|개|년|개월|주|일|시간|회)?/gu)].map(([match]) => match);
}

export function inspectCandidateQuality(input: CandidateQualityInput): CandidateQualityIssue[] {
  const issues: CandidateQualityIssue[] = [];
  const resultLength = countCharacters(input.text, input.countMode);
  const sourceLength = countCharacters(input.sourceText, input.countMode);

  if (input.kind !== 'preserve' && sourceLength > input.targetLength) {
    if (resultLength > input.targetLength) {
      issues.push({
        code: 'too-long',
        message: `현재 ${resultLength}자로 목표보다 ${resultLength - input.targetLength}자 많습니다.`,
      });
    } else if (resultLength < Math.max(1, input.targetLength - 2)) {
      issues.push({
        code: 'too-short',
        message: `현재 ${resultLength}자로 목표보다 불필요하게 ${input.targetLength - resultLength}자 짧습니다.`,
      });
    }
  }

  const sourceNumbers = new Set(extractNumbers(input.sourceText));
  const resultNumbers = new Set(extractNumbers(input.text));
  const addedNumbers = [...resultNumbers].filter((number) => !sourceNumbers.has(number));
  const removedNumbers = [...sourceNumbers].filter((number) => !resultNumbers.has(number));
  if (addedNumbers.length > 0) {
    issues.push({ code: 'number-added', message: `원문에 없는 숫자(${addedNumbers.join(', ')})가 추가되었습니다.` });
  }
  if (removedNumbers.length > 0) {
    issues.push({ code: 'number-removed', message: `원문의 숫자(${removedNumbers.join(', ')})가 누락되었습니다.` });
  }

  const addedCliches = bannedCliches.filter((phrase) => !input.sourceText.includes(phrase) && input.text.includes(phrase));
  if (addedCliches.length > 0) {
    issues.push({ code: 'cliche-added', message: `원문에 없던 상투어(${addedCliches.join(', ')})가 추가되었습니다.` });
  }

  if (input.text.trim().length > 0 && !/[.!?다요함됨음임죠]$/u.test(input.text.trim())) {
    issues.push({ code: 'unfinished', message: '마지막 문장이 완결된 형태로 끝나지 않습니다.' });
  }

  return issues;
}
