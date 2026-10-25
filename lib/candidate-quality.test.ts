import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectCandidateQuality } from './candidate-quality.ts';

void test('목표보다 불필요하게 짧은 일반 후보를 찾는다', () => {
  const issues = inspectCandidateQuality({
    kind: 'balanced',
    text: '팀을 이끌어 17%를 줄였습니다.',
    sourceText: '팀원과 원인을 분석하고 개선안을 적용해 전력 사용량을 17% 줄였습니다.',
    targetLength: 30,
    countMode: 'include-whitespace',
  });

  assert.ok(issues.some((issue) => issue.code === 'too-short'));
});

void test('보호 우선 후보는 목표 초과를 허용한다', () => {
  const sourceText = '마지막 한 명이 이해할 때까지 과정을 공유했습니다.';
  const issues = inspectCandidateQuality({
    kind: 'preserve',
    text: sourceText,
    sourceText,
    targetLength: 10,
    countMode: 'include-whitespace',
  });

  assert.ok(!issues.some((issue) => issue.code === 'too-long'));
});

void test('숫자 변경과 새 상투어를 찾는다', () => {
  const issues = inspectCandidateQuality({
    kind: 'aggressive',
    text: '3주간 운영해 20%를 줄였고 값진 경험이었습니다.',
    sourceText: '3주간 운영해 17%를 줄였습니다.',
    targetLength: 28,
    countMode: 'include-whitespace',
  });

  assert.ok(issues.some((issue) => issue.code === 'number-added'));
  assert.ok(issues.some((issue) => issue.code === 'number-removed'));
  assert.ok(issues.some((issue) => issue.code === 'cliche-added'));
});
