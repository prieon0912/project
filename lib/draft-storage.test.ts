import assert from 'node:assert/strict';
import test from 'node:test';

import { DraftValidationError, normalizeWorkDraft } from './draft-storage.ts';

void test('저장 입력을 안전한 글 데이터로 정규화한다', () => {
  const result = normalizeWorkDraft({
    title: '  환경 프로젝트  ',
    originalText: '센서 오류를 기록했습니다.',
    targetLength: 20,
    countMode: 'include-whitespace',
    currentStep: 'protect',
    comparisonMode: 'generate',
    protectedExpressions: [{ id: 'p1', text: '센서 오류', start: 0, end: 5, category: 'effort' }],
  });

  assert.equal(result.title, '환경 프로젝트');
  assert.equal(result.currentStep, 'protect');
  assert.equal(result.protectedExpressions.length, 1);
  assert.deepEqual(result.candidates, []);
});

void test('원문 위치와 맞지 않는 보호 표현은 저장하지 않는다', () => {
  const result = normalizeWorkDraft({
    originalText: '원문',
    targetLength: 10,
    protectedExpressions: [{ id: 'p1', text: '다른 글', start: 0, end: 2, category: 'effort' }],
  });
  assert.deepEqual(result.protectedExpressions, []);
});

void test('잘못된 목표 글자 수를 거부한다', () => {
  assert.throws(() => normalizeWorkDraft({ originalText: '글', targetLength: 0 }), DraftValidationError);
});
