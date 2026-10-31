import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { WorkDraft, WorkRecord, WorkSummary } from './contracts';

const OWNER_COOKIE = 'sentence_draft_owner';
const OWNER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface DraftRow {
  id: string;
  owner_key: string;
  title: string;
  original_text: string;
  target_length: number;
  count_mode: WorkDraft['countMode'];
  protected_expressions: WorkDraft['protectedExpressions'];
  current_step: WorkDraft['currentStep'];
  comparison_mode: WorkDraft['comparisonMode'];
  revised_text: string;
  candidates: WorkDraft['candidates'];
  manual_version: string;
  selected_candidate_id: string | null;
  final_text: string | null;
  created_at: string;
  updated_at: string;
}

export class DraftDatabaseNotConfiguredError extends Error {}

let databaseClient: SupabaseClient | null = null;

export function getDraftDatabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new DraftDatabaseNotConfiguredError('Supabase 환경변수가 설정되지 않았습니다.');
  databaseClient ??= createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return databaseClient;
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

async function hashOwnerToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getDraftOwner(request: Request) {
  const existing = readCookie(request, OWNER_COOKIE);
  const token = existing && OWNER_TOKEN_PATTERN.test(existing) ? existing : crypto.randomUUID();
  return { token, ownerKey: await hashOwnerToken(token), shouldSetCookie: token !== existing };
}

export function ownerCookieHeader(owner: Awaited<ReturnType<typeof getDraftOwner>>): HeadersInit | undefined {
  if (!owner.shouldSetCookie) return undefined;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return {
    'Set-Cookie': `${OWNER_COOKIE}=${encodeURIComponent(owner.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  };
}

export function workDraftToRow(draft: WorkDraft, ownerKey: string) {
  return {
    owner_key: ownerKey,
    title: draft.title,
    original_text: draft.originalText,
    target_length: draft.targetLength,
    count_mode: draft.countMode,
    protected_expressions: draft.protectedExpressions,
    current_step: draft.currentStep,
    comparison_mode: draft.comparisonMode,
    revised_text: draft.revisedText,
    candidates: draft.candidates,
    manual_version: draft.manualVersion,
    selected_candidate_id: draft.selectedCandidateId,
    final_text: draft.finalText,
  };
}

export function rowToWorkRecord(row: DraftRow): WorkRecord {
  return {
    id: row.id,
    title: row.title,
    originalText: row.original_text,
    targetLength: row.target_length,
    countMode: row.count_mode,
    protectedExpressions: row.protected_expressions ?? [],
    currentStep: row.current_step,
    comparisonMode: row.comparison_mode,
    revisedText: row.revised_text ?? '',
    candidates: row.candidates ?? [],
    manualVersion: row.manual_version ?? '',
    selectedCandidateId: row.selected_candidate_id,
    finalText: row.final_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToWorkSummary(row: Pick<DraftRow, 'id' | 'title' | 'current_step' | 'original_text' | 'created_at' | 'updated_at'>): WorkSummary {
  return {
    id: row.id,
    title: row.title,
    currentStep: row.current_step,
    originalLength: Array.from(row.original_text ?? '').length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
