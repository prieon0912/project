import { DraftValidationError, normalizeWorkDraft } from '@/lib/draft-storage';
import {
  DraftDatabaseNotConfiguredError,
  getDraftDatabase,
  getDraftOwner,
  ownerCookieHeader,
  rowToWorkRecord,
  rowToWorkSummary,
  workDraftToRow,
} from '@/lib/draft-server';

function databaseError(error: unknown, headers?: HeadersInit) {
  const notConfigured = error instanceof DraftDatabaseNotConfiguredError;
  return Response.json(
    {
      code: notConfigured ? 'DRAFT_DATABASE_NOT_CONFIGURED' : 'DRAFT_DATABASE_FAILED',
      message: notConfigured ? error.message : '저장된 글을 처리하지 못했습니다.',
      retryable: !notConfigured,
    },
    { status: notConfigured ? 503 : 500, headers },
  );
}

export async function GET(request: Request) {
  const owner = await getDraftOwner(request);
  const headers = ownerCookieHeader(owner);

  try {
    const { data, error } = await getDraftDatabase()
      .from('drafts')
      .select('id,title,current_step,original_text,created_at,updated_at')
      .eq('owner_key', owner.ownerKey)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return Response.json({ drafts: (data ?? []).map((row) => rowToWorkSummary(row as never)) }, { headers });
  } catch (error) {
    return databaseError(error, headers);
  }
}

export async function POST(request: Request) {
  const owner = await getDraftOwner(request);
  const headers = ownerCookieHeader(owner);

  try {
    const draft = normalizeWorkDraft(await request.json());
    const { data, error } = await getDraftDatabase()
      .from('drafts')
      .insert(workDraftToRow(draft, owner.ownerKey))
      .select('*')
      .single();
    if (error) throw error;
    return Response.json({ draft: rowToWorkRecord(data as never) }, { status: 201, headers });
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return Response.json({ code: 'INVALID_DRAFT', message: error.message, retryable: false }, { status: 400, headers });
    }
    return databaseError(error, headers);
  }
}
