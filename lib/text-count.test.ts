import assert from 'node:assert/strict';
import test from 'node:test';

import { countCharacters, getCharacterCountSnapshot, normalizeTargetLengthInput } from './text-count.ts';

void test('목표 글자 수 앞의 불필요한 0을 제거한다', () => {
  assert.equal(normalizeTargetLengthInput('08'), '8');
  assert.equal(normalizeTargetLengthInput('0008'), '8');
  assert.equal(normalizeTargetLengthInput('0'), '0');
});

void test('공백 포함과 제외 기준을 각각 계산한다', () => {
  assert.equal(countCharacters('나는 학교에 간다.\n다시 온다.', 'include-whitespace'), 17);
  assert.equal(countCharacters('나는 학교에 간다.\n다시 온다.', 'exclude-whitespace'), 13);
});

void test('조합형 이모지를 화면에 보이는 한 글자로 계산한다', () => {
  assert.equal(countCharacters('도전👍🏽', 'include-whitespace'), 3);
});

void test('목표보다 적을 때 남은 글자 수를 알려준다', () => {
  const result = getCharacterCountSnapshot('안녕하세요', 10, 'include-whitespace');
  assert.equal(result.current, 5);
  assert.equal(result.remaining, 5);
  assert.equal(result.status, 'under');
});

void test('목표 초과 상태를 구분한다', () => {
  const result = getCharacterCountSnapshot('여섯글자예요', 5, 'include-whitespace');
  assert.equal(result.overBy, 1);
  assert.equal(result.status, 'over');
});
