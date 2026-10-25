import type { ProtectedExpression } from '@/lib/contracts';

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

export function maskProtectedText(source: string, expressions: ProtectedExpression[]): MaskedProtectedText {
  const sorted = [...expressions].sort((left, right) => left.start - right.start);
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
      throw new Error('보호 표현 위치가 현재 원문과 일치하지 않습니다. 입력 단계에서 다시 등록해 주세요.');
    }

    const token = `[[PROTECTED_${String(index + 1).padStart(3, '0')}]]`;
    maskedText += source.slice(cursor, expression.start) + token;
    tokens.push({ token, originalText: expression.text, category: expression.category });
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
  const replacementByToken = new Map(replacements.map((replacement) => [replacement.token, replacement.text]));

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

export function maskProtectedOccurrences(source: string, tokens: ProtectedToken[]): string {
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
