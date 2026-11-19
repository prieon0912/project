import type { CharacterCountMode, ProtectedExpression } from './contracts.ts';
import { countCharacters } from './text-count.ts';

export interface ProtectedToken {
  token: string;
  originalText: string;
  category: ProtectedExpression['category'];
}

export interface MaskedProtectedText {
  maskedText: string;
  tokens: ProtectedToken[];
}

export interface RestoredProtectedText {
  text: string;
  invalidTokens: string[];
}

export interface ReconciledProtectedExpressions {
  expressions: ProtectedExpression[];
  removed: ProtectedExpression[];
}

export interface ProtectedLengthSummary {
  protectedLength: number;
  targetLength: number;
  overBy: number;
  exceedsTarget: boolean;
}

function findChangedRange(previousText: string, nextText: string) {
  let prefixLength = 0;
  const sharedLength = Math.min(previousText.length, nextText.length);

  while (
    prefixLength < sharedLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - 1 - suffixLength] ===
      nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    previousStart: prefixLength,
    previousEnd: previousText.length - suffixLength,
  };
}

export function reconcileProtectedExpressions(
  previousText: string,
  nextText: string,
  expressions: ProtectedExpression[],
): ReconciledProtectedExpressions {
  if (previousText === nextText || expressions.length === 0) {
    return { expressions, removed: [] };
  }

  const changedRange = findChangedRange(previousText, nextText);
  const lengthDifference = nextText.length - previousText.length;
  const kept: ProtectedExpression[] = [];
  const removed: ProtectedExpression[] = [];

  expressions.forEach((expression) => {
    const isBeforeChange = expression.end <= changedRange.previousStart;
    const isAfterChange = expression.start >= changedRange.previousEnd;
    const nextStart = isAfterChange
      ? expression.start + lengthDifference
      : expression.start;
    const nextEnd = isAfterChange
      ? expression.end + lengthDifference
      : expression.end;

    if (
      (isBeforeChange || isAfterChange) &&
      nextStart >= 0 &&
      nextEnd <= nextText.length &&
      nextText.slice(nextStart, nextEnd) === expression.text
    ) {
      kept.push({ ...expression, start: nextStart, end: nextEnd });
      return;
    }

    removed.push(expression);
  });

  return {
    expressions: kept.sort((left, right) => left.start - right.start),
    removed,
  };
}

export function getProtectedLengthSummary(
  expressions: ProtectedExpression[],
  targetLength: number,
  countMode: CharacterCountMode,
): ProtectedLengthSummary {
  const protectedLength = expressions.reduce(
    (total, expression) => total + countCharacters(expression.text, countMode),
    0,
  );
  const safeTarget = Number.isFinite(targetLength)
    ? Math.max(0, Math.trunc(targetLength))
    : 0;
  const overBy = Math.max(0, protectedLength - safeTarget);

  return {
    protectedLength,
    targetLength: safeTarget,
    overBy,
    exceedsTarget: safeTarget > 0 && overBy > 0,
  };
}

export function maskProtectedText(
  source: string,
  expressions: ProtectedExpression[],
): MaskedProtectedText {
  const sorted = [...expressions].sort(
    (left, right) => left.start - right.start,
  );
  const tokens: ProtectedToken[] = [];
  let cursor = 0;
  let maskedText = '';

  sorted.forEach((expression, index) => {
    if (
      expression.start < cursor ||
      expression.end <= expression.start ||
      expression.end > source.length ||
      source.slice(expression.start, expression.end) !== expression.text
    ) {
      throw new Error(
        '보호 표현 위치가 현재 원문과 일치하지 않습니다. 입력 단계에서 다시 등록해 주세요.',
      );
    }

    const token = `[[PROTECTED_${String(index + 1).padStart(3, '0')}]]`;
    maskedText += source.slice(cursor, expression.start) + token;
    tokens.push({
      token,
      originalText: expression.text,
      category: expression.category,
    });
    cursor = expression.end;
  });

  maskedText += source.slice(cursor);
  return { maskedText, tokens };
}

export function restoreProtectedText(
  source: string,
  tokens: ProtectedToken[],
  replacements: Array<{ token: string; text: string }> = [],
): RestoredProtectedText {
  let text = source;
  const invalidTokens: string[] = [];
  const replacementByToken = new Map(
    replacements.map((replacement) => [replacement.token, replacement.text]),
  );

  tokens.forEach(({ token, originalText }) => {
    const occurrences = text.split(token).length - 1;
    if (occurrences !== 1) {
      invalidTokens.push(token);
      return;
    }
    text = text.replace(token, replacementByToken.get(token) ?? originalText);
  });

  return { text, invalidTokens };
}

export function maskProtectedOccurrences(
  source: string,
  tokens: ProtectedToken[],
): string {
  let maskedText = source;

  tokens.forEach(({ token, originalText }) => {
    const firstOccurrence = maskedText.indexOf(originalText);
    if (firstOccurrence === -1) return;

    maskedText =
      maskedText.slice(0, firstOccurrence) +
      token +
      maskedText.slice(firstOccurrence + originalText.length);
  });

  return maskedText;
}
