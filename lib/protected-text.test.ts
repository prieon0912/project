import assert from 'node:assert/strict';
import test from 'node:test';

import { maskProtectedOccurrences, maskProtectedText, restoreProtectedText } from './protected-text.ts';

void test('여러 보호 표현을 토큰으로 바꾸고 원문 그대로 복원한다', () => {
  const source = '동아리에서 12명의 의견을 모아 끝까지 문제를 해결했습니다.';
  const first = source.indexOf('12명');
  const second = source.indexOf('끝까지');
  const result = maskProtectedText(source, [
    { id: 'one', text: '12명', start: first, end: first + 3, category: 'specific-number' },
    { id: 'two', text: '끝까지', start: second, end: second + 3, category: 'effort' },
  ]);

  assert.equal(result.maskedText, '동아리에서 [[PROTECTED_001]]의 의견을 모아 [[PROTECTED_002]] 문제를 해결했습니다.');
  assert.deepEqual(restoreProtectedText(result.maskedText, result.tokens), { text: source, invalidTokens: [] });
});

void test('현재 수정본에는 남아 있는 보호 표현만 마스킹한다', () => {
  const source = '12명의 의견을 끝까지 모았습니다.';
  const first = source.indexOf('12명');
  const second = source.indexOf('끝까지');
  const { tokens } = maskProtectedText(source, [
    { id: 'one', text: '12명', start: first, end: first + 3, category: 'specific-number' },
    { id: 'two', text: '끝까지', start: second, end: second + 3, category: 'effort' },
  ]);

  assert.equal(maskProtectedOccurrences('의견을 12명에게 물었습니다.', tokens), '의견을 [[PROTECTED_001]]에게 물었습니다.');
});

void test('보호 토큰이 누락되거나 중복되면 결과를 무효로 표시한다', () => {
  const tokens = [{ token: '[[PROTECTED_001]]', originalText: '끝까지', category: 'effort' as const }];

  assert.deepEqual(restoreProtectedText('토큰 없음', tokens).invalidTokens, ['[[PROTECTED_001]]']);
  assert.deepEqual(
    restoreProtectedText('[[PROTECTED_001]] 그리고 [[PROTECTED_001]]', tokens).invalidTokens,
    ['[[PROTECTED_001]]'],
  );
});

void test('허용된 후보에서는 보호 표현을 지정된 문구로 조정해 복원한다', () => {
  const tokens = [{ token: '[[PROTECTED_001]]', originalText: '마지막 한 명이 이해할 때까지', category: 'effort' as const }];
  const result = restoreProtectedText('저는 [[PROTECTED_001]] 설명했습니다.', tokens, [
    { token: '[[PROTECTED_001]]', text: '모두 이해할 때까지' },
  ]);

  assert.deepEqual(result, { text: '저는 모두 이해할 때까지 설명했습니다.', invalidTokens: [] });
});
