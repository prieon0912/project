'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, FilePenLine, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterCountMode, GeneratedCandidate, ProtectedExpression } from '@/lib/contracts';
import { maskProtectedOccurrences, maskProtectedText, restoreProtectedText } from '@/lib/protected-text';
import { countCharacters } from '@/lib/text-count';
import { diffText } from '@/lib/text-diff';

type ComparisonMode = 'generate' | 'reconcile';

interface CandidateComparisonProps {
  originalText: string;
  targetLength: number;
  countMode: CharacterCountMode;
  protectedExpressions: ProtectedExpression[];
  onBack: () => void;
}

const candidateTones: Record<GeneratedCandidate['kind'], string> = {
  preserve: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  balanced: 'border-blue-200 bg-blue-50 text-blue-800',
  aggressive: 'border-amber-200 bg-amber-50 text-amber-900',
};

const candidateLabels: Record<GeneratedCandidate['kind'], string> = {
  aggressive: '1안 · 글자 수 우선',
  balanced: '2안 · 조건부 보호',
  preserve: '3안 · 보호 우선',
};

const candidateDescriptions: Record<GeneratedCandidate['kind'], string> = {
  aggressive: '목표를 맞추기 어렵다면 보호 표현도 의미를 유지하며 조정할 수 있습니다.',
  balanced: '보호 표현 전체만으로 목표를 넘을 때에만 보호 표현을 조정합니다.',
  preserve: '목표를 초과하더라도 보호 표현을 원문 그대로 유지합니다.',
};

const candidateOrder: GeneratedCandidate['kind'][] = ['aggressive', 'balanced', 'preserve'];

function DiffView({ before, after }: { before: string; after: string }) {
  const diff = useMemo(() => diffText(before, after), [after, before]);

  return (
    <div className="max-h-52 overflow-auto rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
      {diff.map((segment, index) => (
        <span
          key={`${segment.type}-${index}`}
          className={
            segment.type === 'removed'
              ? 'bg-rose-100 text-rose-700 line-through decoration-2'
              : segment.type === 'added'
                ? 'bg-blue-100 font-semibold text-blue-800 underline decoration-2 underline-offset-2'
                : undefined
          }
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  originalText,
  targetLength,
  countMode,
  protectedCount,
}: {
  candidate: GeneratedCandidate;
  originalText: string;
  targetLength: number;
  countMode: CharacterCountMode;
  protectedCount: number;
}) {
  const actualLength = countCharacters(candidate.text, countMode);
  const difference = actualLength - targetLength;
  const changes = diffText(originalText, candidate.text).filter(
    (segment) => segment.type !== 'same' && segment.text.trim().length > 0,
  );
  const protectedChanges = candidate.analysis.protectedExpressionChanges ?? [];

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className={candidateTones[candidate.kind]}>
              {candidateLabels[candidate.kind]}
            </Badge>
            <p className="mt-2 max-w-64 text-sm leading-6 text-slate-500">{candidateDescriptions[candidate.kind]}</p>
            <div className="mt-3 flex items-baseline gap-2 tabular-nums">
              <strong className="text-3xl font-black text-slate-950">{actualLength.toLocaleString()}</strong>
              <span className="text-sm font-bold text-slate-500">자</span>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${difference > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {difference > 0 ? `${difference.toLocaleString()}자 초과` : `${Math.abs(difference).toLocaleString()}자 여유`}
          </span>
        </div>
        <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${protectedChanges.length > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
          <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" />
          {protectedChanges.length > 0
            ? `보호 표현 ${protectedChanges.length}개 조건부 조정`
            : `보호 표현 ${protectedCount}개 원문 유지`}
        </div>
      </div>

      <div className="flex-1 p-5">
        <h3 className="text-sm font-extrabold text-slate-900">수정 결과</h3>
        <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-base leading-7 text-slate-800">{candidate.text}</p>

        <h3 className="mt-6 text-sm font-extrabold text-slate-900">원문 대비 표시</h3>
        <div className="mt-3"><DiffView before={originalText} after={candidate.text} /></div>

        <h3 className="mt-6 text-sm font-extrabold text-slate-900">수정 내역</h3>
        {changes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">원문과 달라진 부분이 없습니다.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {changes.slice(0, 10).map((change, index) => (
              <li key={`${change.type}-${index}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-black ${change.type === 'removed' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                  {change.type === 'removed' ? '삭제' : '추가'}
                </span>
                <span className="break-words text-slate-700">{change.text.trim()}</span>
              </li>
            ))}
            {changes.length > 10 && <li className="text-sm font-semibold text-slate-500">외 {changes.length - 10}개 변경</li>}
          </ol>
        )}

        {candidate.analysis.evidence.length > 0 && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
            <p className="font-extrabold">절충 기준</p>
            {candidate.analysis.evidence.slice(0, 3).map((entry) => <p key={entry} className="mt-1">{entry}</p>)}
          </div>
        )}
        {protectedChanges.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <p className="font-extrabold">보호 표현 조정 내역</p>
            {protectedChanges.map((change) => <p key={change} className="mt-1">{change}</p>)}
          </div>
        )}
        {candidate.analysis.naturalnessWarnings.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <p className="flex items-center gap-2 font-extrabold"><AlertTriangle aria-hidden="true" className="size-4" />자연스러움 확인 필요</p>
            {candidate.analysis.naturalnessWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
          </div>
        )}
      </div>
    </article>
  );
}

export function CandidateComparison({ originalText, targetLength, countMode, protectedExpressions, onBack }: CandidateComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>('generate');
  const [revisedText, setRevisedText] = useState('');
  const [candidates, setCandidates] = useState<GeneratedCandidate[]>([]);
  const [manualVersion, setManualVersion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const revisedLength = countCharacters(revisedText, countMode);
  const preliminaryChanges = useMemo(
    () => diffText(originalText, revisedText).filter((segment) => segment.type !== 'same' && segment.text.trim().length > 0),
    [originalText, revisedText],
  );

  const generateCandidates = async () => {
    if (mode === 'reconcile' && revisedText.trim().length === 0) return;
    setIsGenerating(true);
    setError('');

    try {
      const { maskedText, tokens } = maskProtectedText(originalText, protectedExpressions);
      const lockedTokens = tokens.map(({ token }) => token);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          maskedText,
          revisedMaskedText: mode === 'reconcile' ? maskProtectedOccurrences(revisedText, tokens) : undefined,
          targetLength,
          countMode,
          lockedTokens,
          protectedItems: tokens.map(({ token, originalText: protectedText }) => ({ token, originalText: protectedText })),
        }),
      });
      const result = (await response.json()) as { candidates?: GeneratedCandidate[]; manualVersion?: string; message?: string };
      if (!response.ok || !result.candidates) throw new Error(result.message || 'Gemini가 후보를 생성하지 못했습니다.');

      const restored = result.candidates.map((candidate) => {
        const restoredCandidate = restoreProtectedText(candidate.text, tokens, candidate.protectedReplacements);
        if (restoredCandidate.invalidTokens.length > 0) {
          throw new Error('Gemini가 보호 표현을 누락하거나 중복했습니다. 보호를 위해 모든 결과를 적용하지 않았습니다.');
        }
        return { ...candidate, text: restoredCandidate.text };
      });
      setCandidates(
        restored.sort(
          (left, right) => candidateOrder.indexOf(left.kind) - candidateOrder.indexOf(right.kind),
        ),
      );
      setManualVersion(result.manualVersion ?? '');
    } catch (generationError) {
      setCandidates([]);
      setManualVersion('');
      setError(generationError instanceof Error ? generationError.message : '후보를 생성하지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-7 p-5 sm:p-8">
      <Button type="button" variant="ghost" onClick={onBack} className="-ml-2 h-10 px-3 text-sm font-bold text-slate-600">
        보호 표현 수정
      </Button>

      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-black text-slate-950">진행 방식 선택</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">새 축약안을 만들거나, 직접 수정한 현재본과 이전본 사이의 절충안을 만듭니다.</p>
          </div>
          <Badge variant="outline" className="h-7 px-3 text-sm"><ShieldCheck aria-hidden="true" />보호 표현 {protectedExpressions.length}개 잠금</Badge>
        </div>

        <RadioGroup
          value={mode}
          onValueChange={(value) => {
            setMode(value as ComparisonMode);
            setCandidates([]);
            setError('');
          }}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <label htmlFor="mode-generate" className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${mode === 'generate' ? 'border-blue-500 bg-blue-50 ring-3 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <RadioGroupItem id="mode-generate" value="generate" className="mt-1" />
            <Bot aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-blue-700" />
            <span>
              <strong className="block text-base font-extrabold text-slate-950">문장결 AI로 새 축약안 만들기</strong>
              <span className="mt-1 block text-sm leading-6 text-slate-600">보호 표현과 목표 글자 수의 우선순위가 다른 후보 세 개를 만듭니다.</span>
            </span>
          </label>
          <label htmlFor="mode-reconcile" className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${mode === 'reconcile' ? 'border-violet-500 bg-violet-50 ring-3 ring-violet-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <RadioGroupItem id="mode-reconcile" value="reconcile" className="mt-1" />
            <FilePenLine aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-violet-700" />
            <span>
              <strong className="block text-base font-extrabold text-slate-950">직접·외부에서 수정한 글 가져오기</strong>
              <span className="mt-1 block text-sm leading-6 text-slate-600">내가 직접 고쳤거나 다른 도구에서 만든 현재본을 붙여넣어 이전본과 비교합니다.</span>
            </span>
          </label>
        </RadioGroup>

        {mode === 'reconcile' && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <label htmlFor="revised-text" className="text-sm font-extrabold text-slate-900">현재 수정본</label>
                <p className="mt-1 text-sm leading-6 text-slate-600">직접 수정한 글을 붙여넣으세요. Gemini는 이 글을 만든 도구가 아니라 두 버전을 비교하는 분석 엔진으로만 작동합니다.</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-violet-800">
                {revisedLength.toLocaleString()}자 · {revisedLength > targetLength ? `${(revisedLength - targetLength).toLocaleString()}자 초과` : `${(targetLength - revisedLength).toLocaleString()}자 여유`}
              </span>
            </div>
            <Textarea
              id="revised-text"
              value={revisedText}
              onChange={(event) => {
                setRevisedText(event.target.value);
                setCandidates([]);
                setError('');
              }}
              placeholder="직접 수정했거나 외부에서 수정한 현재 버전을 붙여넣으세요."
              className="mt-3 min-h-64 resize-y rounded-2xl border-violet-200 bg-white p-4 text-base leading-8"
            />

            {revisedText.trim().length > 0 && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">이전본과 현재본의 차이</h3>
                  <div className="mt-2"><DiffView before={originalText} after={revisedText} /></div>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <h3 className="text-sm font-extrabold text-slate-900">변경 요약</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">삭제·추가 구간 {preliminaryChanges.length.toLocaleString()}개를 찾았습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">현재본에서 빠진 보호 표현도 후보별 우선순위에 따라 복구하거나 조건부로 조정합니다.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-400" />
            <p className="text-sm leading-6 text-slate-300">1안은 글자 수, 2안은 조건부 보호, 3안은 보호 표현을 가장 우선합니다.</p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={generateCandidates}
            disabled={isGenerating || (mode === 'reconcile' && revisedText.trim().length === 0)}
            className="h-11 shrink-0 rounded-xl bg-blue-600 px-5 font-extrabold text-white hover:bg-blue-500"
          >
            {isGenerating ? <Loader2 aria-hidden="true" className="animate-spin" /> : candidates.length > 0 ? <RefreshCw aria-hidden="true" /> : <Bot aria-hidden="true" />}
            {isGenerating
              ? '분석 중…'
              : candidates.length > 0
                ? '다시 분석'
                : mode === 'reconcile'
                  ? '차이 분석 및 절충안 생성'
                  : '축약안 3개 생성'}
          </Button>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div><strong className="block">생성하지 못했습니다.</strong><span>{error}</span></div>
          </div>
        )}
      </section>

      {candidates.length === 0 && !isGenerating ? (
        <section className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <div>
            <Bot aria-hidden="true" className="mx-auto size-9 text-slate-300" />
            <h2 className="mt-3 text-base font-extrabold text-slate-700">
              {mode === 'reconcile' ? '현재 수정본을 입력하면 세 가지 절충안을 만들 수 있습니다.' : '문장결 AI로 세 가지 축약안을 만들어 보세요.'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              글자 수 우선·조건부 보호·보호 우선 결과가 차례로 표시됩니다.
            </p>
          </div>
        </section>
      ) : (
        <div>
          {manualVersion && (
            <p className="mb-3 text-right text-sm font-semibold text-slate-500">최소 수정 매뉴얼 v1 적용 · 글자 수 자동 검증 완료</p>
          )}
          <section aria-label="축약안 비교 결과" className="grid gap-4 xl:grid-cols-3">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                originalText={originalText}
                targetLength={targetLength}
                countMode={countMode}
                protectedCount={protectedExpressions.length}
              />
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
