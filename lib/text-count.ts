import type { CharacterCountMode } from '@/lib/contracts';

export type CharacterCountStatus = 'under' | 'exact' | 'over';

export interface CharacterCountSnapshot {
  current: number;
  target: number;
  difference: number;
  remaining: number;
  overBy: number;
  progressPercent: number;
  status: CharacterCountStatus;
  message: string;
}

const graphemeSegmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export function splitGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

export function countCharacters(text: string, mode: CharacterCountMode): number {
  return splitGraphemes(text).filter((character) => {
    return mode === 'include-whitespace' || !/^\s+$/u.test(character);
  }).length;
}

export function normalizeTargetLengthInput(value: string): string {
  return value.replace(/^0+(?=\d)/u, '');
}

export function getCharacterCountSnapshot(
  text: string,
  target: number,
  mode: CharacterCountMode,
): CharacterCountSnapshot {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.trunc(target)) : 0;
  const current = countCharacters(text, mode);
  const difference = current - safeTarget;
  const status: CharacterCountStatus = difference > 0 ? 'over' : difference === 0 && safeTarget > 0 ? 'exact' : 'under';
  const progressPercent = safeTarget === 0 ? 0 : Math.min(100, Math.round((current / safeTarget) * 100));

  let message = '글을 입력하면 글자 수를 바로 계산합니다.';
  if (safeTarget === 0) {
    message = '목표 글자 수를 1자 이상 입력하세요.';
  } else if (status === 'over') {
    message = `목표보다 ${difference.toLocaleString()}자 많습니다.`;
  } else if (status === 'exact') {
    message = '목표 글자 수에 정확히 맞았습니다.';
  } else if (current > 0) {
    message = `목표까지 ${Math.abs(difference).toLocaleString()}자 남았습니다.`;
  }

  return {
    current,
    target: safeTarget,
    difference,
    remaining: Math.max(0, -difference),
    overBy: Math.max(0, difference),
    progressPercent,
    status,
    message,
  };
}
