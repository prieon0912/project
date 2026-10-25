'use client';

import { useMemo, useRef, useState } from 'react';
import { AlignLeft, CheckCircle2, FileText, Goal, Highlighter, Plus, Sparkles, Trash2, X } from 'lucide-react';

import { CandidateComparison } from '@/app/candidate-comparison';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterCountMode, ProtectedExpression, ProtectedExpressionCategory } from '@/lib/contracts';
import { getCharacterCountSnapshot, normalizeTargetLengthInput } from '@/lib/text-count';

const countModeOptions: Array<{ value: CharacterCountMode; label: string }> = [
  { value: 'include-whitespace', label: '공백 포함' },
  { value: 'exclude-whitespace', label: '공백 제외' },
];

const protectedCategoryOptions: Array<{ value: ProtectedExpressionCategory; label: string }> = [
  { value: 'effort', label: '노력' },
  { value: 'initiative', label: '주도성' },
  { value: 'specific-number', label: '구체적 수치' },
  { value: 'failure-recovery', label: '실패와 극복' },
  { value: 'unique-expression', label: '나만의 표현' },
];

const protectedCategoryLabels = Object.fromEntries(
  protectedCategoryOptions.map((option) => [option.value, option.label]),
) as Record<ProtectedExpressionCategory, string>;

interface PendingSelection {
  start: number;
  end: number;
  text: string;
}

function normalizeSelection(source: string, selectionStart: number, selectionEnd: number): PendingSelection | null {
  let start = Math.min(selectionStart, selectionEnd);
  let end = Math.max(selectionStart, selectionEnd);

  while (start < end && /\s/u.test(source[start])) start += 1;
  while (end > start && /\s/u.test(source[end - 1])) end -= 1;

  return start === end ? null : { start, end, text: source.slice(start, end) };
}

export function EssayDraftEditor() {
  const [originalText, setOriginalText] = useState('');
  const [targetLength, setTargetLength] = useState(500);
  const [countMode, setCountMode] = useState<CharacterCountMode>('include-whitespace');
  const [currentStep, setCurrentStep] = useState<'input' | 'protect' | 'compare'>('input');
  const [protectedExpressions, setProtectedExpressions] = useState<ProtectedExpression[]>([]);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [protectedCategory, setProtectedCategory] = useState<ProtectedExpressionCategory>('effort');
  const selectionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const countSnapshot = useMemo(
    () => getCharacterCountSnapshot(originalText, targetLength, countMode),
    [countMode, originalText, targetLength],
  );

  const statusTone =
    countSnapshot.status === 'over'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : countSnapshot.status === 'exact'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-900';
  const canContinue = originalText.trim().length > 0 && targetLength >= 1 && targetLength <= 10_000;
  const selectionOverlaps = pendingSelection
    ? protectedExpressions.some(
        (expression) => pendingSelection.start < expression.end && pendingSelection.end > expression.start,
      )
    : false;

  const addProtectedExpression = () => {
    if (!pendingSelection || selectionOverlaps) return;

    setProtectedExpressions((current) =>
      [
        ...current,
        {
          id: crypto.randomUUID(),
          text: pendingSelection.text,
          start: pendingSelection.start,
          end: pendingSelection.end,
          category: protectedCategory,
        },
      ].sort((left, right) => left.start - right.start),
    );
    setPendingSelection(null);
    selectionTextareaRef.current?.setSelectionRange(0, 0);
  };

  const stepCopy = {
    input: {
      badge: '입력 단계',
      title: '줄이고 싶은 글을 입력하세요',
      description: '원문과 목표 글자 수를 설정합니다. 입력한 내용은 아직 서버로 전송되지 않습니다.',
    },
    protect: {
      badge: '보호 표현 단계',
      title: '보호할 표현을 선택하세요',
      description: '축약 결과에서도 반드시 남겨야 할 노력, 수치, 경험과 표현을 원문에서 선택합니다.',
    },
    compare: {
      badge: '축약안 비교 단계',
      title: '세 가지 축약안을 비교하세요',
      description: '문장결 AI로 새 후보를 만들거나, 직접 수정한 현재본을 이전본과 비교해 절충안을 확인합니다.',
    },
  }[currentStep];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-950">
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white shadow-sm">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-base font-extrabold tracking-[-0.02em]">문장결</p>
              <p className="text-sm text-slate-500">표현을 지키는 글자 수 맞춤 도구</p>
            </div>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 sm:flex">
            <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />
            {stepCopy.badge}
          </span>
        </div>
      </header>

      <section className={`mx-auto grid gap-6 px-5 py-8 sm:px-8 lg:py-12 ${currentStep === 'compare' ? 'max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_260px]' : 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_280px]'}`}>
        <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700">
              <Sparkles aria-hidden="true" className="size-4" />
              새 축약 작업
            </p>
            <h1 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">{stepCopy.title}</h1>
            <p className="mt-2 text-base leading-7 text-slate-600">{stepCopy.description}</p>
          </div>

          <div className={currentStep === 'input' ? 'space-y-6 p-5 sm:p-8' : 'hidden'}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-slate-800">글자 수 계산 방식</legend>
                <div className="inline-flex rounded-xl bg-slate-100 p-1" aria-label="글자 수 계산 방식">
                  {countModeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={countMode === option.value}
                      onClick={() => setCountMode(option.value)}
                      className={`min-h-10 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-300 ${
                        countMode === option.value
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="target-length" className="mb-2 block text-sm font-bold text-slate-800">
                  목표 글자 수
                </label>
                <div className="relative">
                  <Input
                    id="target-length"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={targetLength}
                    onChange={(event) => {
                      const normalizedValue = normalizeTargetLengthInput(event.currentTarget.value);
                      if (normalizedValue !== event.currentTarget.value) {
                        event.currentTarget.value = normalizedValue;
                      }
                      const nextValue = Number(normalizedValue);
                      setTargetLength(Number.isFinite(nextValue) ? Math.max(0, Math.trunc(nextValue)) : 0);
                    }}
                    className="h-11 pr-10 text-base font-bold"
                    aria-describedby="target-help"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                    자
                  </span>
                </div>
                <p id="target-help" className="sr-only">1자부터 10,000자 사이의 목표를 입력하세요.</p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between gap-4">
                <label htmlFor="original-text" className="text-sm font-bold text-slate-800">
                  원문
                </label>
                <span className="text-sm text-slate-500">직접 입력하거나 붙여넣을 수 있어요</span>
              </div>
              <Textarea
                id="original-text"
                value={originalText}
                onChange={(event) => {
                  setOriginalText(event.target.value);
                  setProtectedExpressions([]);
                  setPendingSelection(null);
                }}
                placeholder="자기소개서나 지원서의 원문을 입력하세요."
                className="min-h-80 resize-y rounded-2xl border-slate-300 bg-slate-50/50 p-5 text-base leading-8 shadow-inner shadow-slate-100 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                aria-describedby="count-status"
              />

              <div id="count-status" className={`mt-3 rounded-2xl border p-4 ${statusTone}`} aria-live="polite">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80">
                      <AlignLeft aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold opacity-75">현재 입력 상태</p>
                      <p className="text-base font-extrabold">{countSnapshot.message}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 self-end tabular-nums sm:self-auto">
                    <strong className="text-3xl font-black">{countSnapshot.current.toLocaleString()}</strong>
                    <span className="text-sm font-bold opacity-70">/ {targetLength.toLocaleString()}자</span>
                  </div>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/80" aria-hidden="true">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-200 ${
                      countSnapshot.status === 'over'
                        ? 'bg-rose-600'
                        : countSnapshot.status === 'exact'
                          ? 'bg-emerald-600'
                          : 'bg-blue-600'
                    }`}
                    style={{ width: `${countSnapshot.progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-sm font-semibold opacity-70">
                  <span>{countMode === 'include-whitespace' ? '공백 포함 기준' : '공백 제외 기준'}</span>
                  <span>{countSnapshot.progressPercent}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 border-t border-slate-100 pt-6">
              <Button
                type="button"
                size="lg"
                disabled={!canContinue}
                onClick={() => setCurrentStep('protect')}
                className="h-12 rounded-xl bg-blue-700 px-5 text-base font-extrabold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800"
              >
                다음: 보호 표현 선택
              </Button>
              {!canContinue && (
                <p className="text-sm text-slate-500">원문과 1~10,000자의 목표 글자 수를 입력하면 이동할 수 있습니다.</p>
              )}
            </div>
          </div>

          {currentStep === 'protect' && (
            <div className="space-y-6 p-5 sm:p-8">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep('input')}
                className="-ml-2 h-10 px-3 text-sm font-bold text-slate-600"
              >
                입력 수정
              </Button>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="h-7 px-3 text-sm">현재 {countSnapshot.current.toLocaleString()}자</Badge>
                <Badge variant="outline" className="h-7 px-3 text-sm">목표 {targetLength.toLocaleString()}자</Badge>
                <Badge variant="outline" className="h-7 px-3 text-sm">
                  {countMode === 'include-whitespace' ? '공백 포함' : '공백 제외'}
                </Badge>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
                <section>
                  <div className="mb-3 flex items-start gap-2">
                    <Highlighter aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">원문에서 남길 부분을 드래그하세요</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">한 부분을 선택해 등록한 뒤, 다른 부분을 다시 선택해 계속 추가할 수 있습니다.</p>
                    </div>
                  </div>

                  <Textarea
                    ref={selectionTextareaRef}
                    readOnly
                    value={originalText}
                    onSelect={(event) => {
                      const target = event.currentTarget;
                      setPendingSelection(normalizeSelection(originalText, target.selectionStart, target.selectionEnd));
                    }}
                    aria-label="보호할 표현을 선택할 원문"
                    className="min-h-96 resize-y rounded-2xl border-slate-300 bg-slate-50/70 p-5 text-base leading-8 selection:bg-blue-200 selection:text-blue-950"
                  />

                  <div className={`mt-3 rounded-2xl border p-4 ${pendingSelection ? 'border-blue-200 bg-blue-50' : 'border-dashed border-slate-300 bg-slate-50'}`}>
                    {pendingSelection ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-blue-700">선택한 표현</p>
                            <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-base font-semibold leading-7 text-slate-900">“{pendingSelection.text}”</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingSelection(null);
                              selectionTextareaRef.current?.setSelectionRange(0, 0);
                            }}
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-300"
                            aria-label="현재 선택 해제"
                          >
                            <X aria-hidden="true" className="size-4" />
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Select
                            value={protectedCategory}
                            onValueChange={(value) => setProtectedCategory(value as ProtectedExpressionCategory)}
                          >
                            <SelectTrigger className="h-11 w-full bg-white text-base" aria-label="보호 표현 분류">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {protectedCategoryOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            onClick={addProtectedExpression}
                            disabled={selectionOverlaps}
                            className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800"
                          >
                            <Plus aria-hidden="true" />
                            보호 리스트에 추가
                          </Button>
                        </div>
                        {selectionOverlaps && (
                          <p className="text-sm font-semibold text-rose-700">이미 보호 중인 표현과 겹칩니다. 겹치지 않는 부분을 선택하세요.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-sm font-semibold text-slate-500">원문에서 보호할 문구를 드래그하면 여기에 표시됩니다.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">보호 리스트</h2>
                      <p className="mt-1 text-sm text-slate-500">{protectedExpressions.length}개 표현 등록됨</p>
                    </div>
                    {protectedExpressions.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProtectedExpressions([])}
                        className="text-slate-500 hover:text-rose-700"
                      >
                        <Trash2 aria-hidden="true" />
                        전체 해제
                      </Button>
                    )}
                  </div>

                  {protectedExpressions.length === 0 ? (
                    <div className="mt-5 grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                      <div>
                        <Highlighter aria-hidden="true" className="mx-auto size-7 text-slate-300" />
                        <p className="mt-3 text-sm font-bold text-slate-500">아직 보호할 표현이 없습니다.</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">원문에서 여러 부분을 차례로 선택해 추가하세요.</p>
                      </div>
                    </div>
                  ) : (
                    <ul className="mt-4 max-h-[31rem] space-y-3 overflow-auto pr-1">
                      {protectedExpressions.map((expression, index) => (
                        <li key={expression.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
                                <Badge variant="secondary">{protectedCategoryLabels[expression.category]}</Badge>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-800">“{expression.text}”</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setProtectedExpressions((current) => current.filter((item) => item.id !== expression.id))}
                              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-rose-200"
                              aria-label={`${expression.text} 보호 해제`}
                            >
                              <X aria-hidden="true" className="size-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="flex flex-col items-end gap-2 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setCurrentStep('compare')}
                  className="h-12 rounded-xl bg-blue-700 px-5 text-base font-extrabold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800"
                >
                  다음: 축약안 비교
                </Button>
                <p className="text-sm text-slate-500">보호 표현 {protectedExpressions.length}개를 적용해 세 가지 후보를 만듭니다.</p>
              </div>
            </div>
          )}

          {currentStep === 'compare' && (
            <CandidateComparison
              originalText={originalText}
              targetLength={targetLength}
              countMode={countMode}
              protectedExpressions={protectedExpressions}
              onBack={() => setCurrentStep('protect')}
            />
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg shadow-slate-900/10">
            <div className="mb-4 flex items-center gap-2 text-blue-300">
              <Goal aria-hidden="true" className="size-5" />
              <h2 className="text-sm font-extrabold">현재 단계</h2>
            </div>
            <ol className="space-y-4 text-sm">
              <li className={`flex gap-3 ${currentStep === 'input' ? '' : 'text-slate-400'}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full font-black ${currentStep === 'input' ? 'bg-blue-500' : 'bg-emerald-500 text-white'}`}>
                  {currentStep === 'input' ? '1' : <CheckCircle2 aria-hidden="true" className="size-4" />}
                </span>
                <div><strong className={currentStep === 'input' ? 'block text-white' : 'block'}>원문과 목표 입력</strong>{currentStep === 'input' && <span className="text-slate-400">지금 진행 중</span>}</div>
              </li>
              <li className={`flex gap-3 ${currentStep === 'protect' ? '' : 'text-slate-400'}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full font-bold ${currentStep === 'protect' ? 'bg-blue-500 text-white' : currentStep === 'compare' ? 'bg-emerald-500 text-white' : 'border border-slate-600'}`}>
                  {currentStep === 'compare' ? <CheckCircle2 aria-hidden="true" className="size-4" /> : '2'}
                </span>
                <div><strong className={currentStep === 'protect' ? 'block text-white' : 'block'}>보호할 표현 선택</strong>{currentStep === 'protect' && <span className="text-slate-400">지금 진행 중</span>}</div>
              </li>
              <li className={`flex gap-3 ${currentStep === 'compare' ? '' : 'text-slate-400'}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full font-bold ${currentStep === 'compare' ? 'bg-blue-500 text-white' : 'border border-slate-600'}`}>3</span>
                <div><strong className={currentStep === 'compare' ? 'block text-white' : 'block'}>축약안 비교</strong>{currentStep === 'compare' && <span className="text-slate-400">지금 진행 중</span>}</div>
              </li>
            </ol>
          </section>

        </aside>
      </section>
    </main>
  );
}
