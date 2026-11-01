import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGeminiModelChain, classifyGeminiFailure } from './gemini-fallback.ts';

void test('기본 모델 뒤에 무료 Flash 대체 모델을 중복 없이 배치한다', () => {
  assert.deepEqual(buildGeminiModelChain('gemini-3.8-flash', 'gemini-3.5-flash-lite, gemini-3.8-flash'), [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ]);
});

void test('모델 혼잡과 할당량 오류를 재시도 가능으로 구분한다', () => {
  assert.deepEqual(classifyGeminiFailure(503, 'This model is currently experiencing high demand.'), {
    retryable: true,
    capacityRelated: true,
    quotaRelated: false,
  });
  assert.equal(classifyGeminiFailure(429, 'Quota exceeded for this model.').quotaRelated, true);
});

void test('잘못된 API 키 오류는 다른 모델로 재시도하지 않는다', () => {
  assert.equal(classifyGeminiFailure(403, 'API key is invalid.').retryable, false);
});
