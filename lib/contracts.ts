export type CharacterCountMode = 'include-whitespace' | 'exclude-whitespace';
export type CandidateKind = 'preserve' | 'balanced' | 'aggressive';
export type GenerationMode = 'generate' | 'reconcile';
export type SemanticRisk = 'maintained' | 'weakened' | 'heavily-weakened';

export type ProtectedExpressionCategory =
  | 'effort'
  | 'initiative'
  | 'specific-number'
  | 'failure-recovery'
  | 'unique-expression';

export interface ProtectedExpression {
  id: string;
  text: string;
  start: number;
  end: number;
  category: ProtectedExpressionCategory;
}

export interface GenerationRequest {
  schemaVersion: 1;
  mode: GenerationMode;
  originalText: string;
  revisedText?: string;
  targetLength: number;
  countMode: CharacterCountMode;
  protectedExpressions: ProtectedExpression[];
  idempotencyKey: string;
}

export interface CandidateAnalysis {
  semanticRisk: SemanticRisk;
  evidence: string[];
  naturalnessWarnings: string[];
  protectedExpressionChanges?: string[];
}

export interface ProtectedReplacement {
  token: string;
  text: string;
}

export interface GeneratedCandidate {
  id: string;
  kind: CandidateKind;
  text: string;
  analysis: CandidateAnalysis;
  protectedReplacements?: ProtectedReplacement[];
}

export interface GenerationResponse {
  schemaVersion: 1;
  requestId: string;
  candidates: GeneratedCandidate[];
}

export interface WorkDraft {
  title: string;
  originalText: string;
  targetLength: number;
  countMode: CharacterCountMode;
  protectedExpressions: ProtectedExpression[];
}

export interface WorkRecord extends WorkDraft {
  id: string;
  userId: string;
  candidates: GeneratedCandidate[];
  selectedCandidateId: string | null;
  finalText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
  requestId?: string;
}

export interface ContractValidationIssue {
  field: keyof GenerationRequest;
  message: string;
}

export function validateGenerationRequest(request: GenerationRequest): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];

  if (request.originalText.trim().length === 0) {
    issues.push({ field: 'originalText', message: '원문을 입력해야 합니다.' });
  }
  if (!Number.isInteger(request.targetLength) || request.targetLength < 1 || request.targetLength > 10_000) {
    issues.push({ field: 'targetLength', message: '목표 글자 수는 1자 이상 10,000자 이하여야 합니다.' });
  }
  if (request.mode === 'reconcile' && (!request.revisedText || request.revisedText.trim().length === 0)) {
    issues.push({ field: 'revisedText', message: '비교할 현재 수정본을 입력해야 합니다.' });
  }
  if (request.schemaVersion !== 1) {
    issues.push({ field: 'schemaVersion', message: '지원하지 않는 데이터 계약 버전입니다.' });
  }

  return issues;
}
