import { DraftValidationError, normalizeWorkDraft } from '@/lib/draft-storage';
import {
  DraftDatabaseNotConfiguredError,
  getDraftDatabase,
  getDraftOwner,
  ownerCookieHeader,
  rowToWorkRecord,
  workDraftToRow,
} from '@/lib/draft-server';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

async function draftId(context: RouteContext) {
  return (await context.params).id;
}

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id);
}

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

export async function GET(request: Request, context: RouteContext) {
  const owner = await getDraftOwner(request);
  const headers = ownerCookieHeader(owner);
  const id = await draftId(context);
  if (!validId(id)) return Response.json({ message: '글 ID가 올바르지 않습니다.' }, { status: 400, headers });

  try {
    const { data, error } = await getDraftDatabase()
      .from('drafts')
      .select('*')
      .eq('id', id)
      .eq('owner_key', owner.ownerKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ message: '저장된 글을 찾지 못했습니다.' }, { status: 404, headers });
    return Response.json({ draft: rowToWorkRecord(data as never) }, { headers });
  } catch (error) {
    return databaseError(error, headers);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const owner = await getDraftOwner(request);
  const headers = ownerCookieHeader(owner);
  const id = await draftId(context);
  if (!validId(id)) return Response.json({ message: '글 ID가 올바르지 않습니다.' }, { status: 400, headers });

  try {
    const draft = normalizeWorkDraft(await request.json());
    const { owner_key: _ownerKey, ...update } = workDraftToRow(draft, owner.ownerKey);
    const { data, error } = await getDraftDatabase()
      .from('drafts')
      .update(update)
      .eq('id', id)
      .eq('owner_key', owner.ownerKey)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ message: '저장된 글을 찾지 못했습니다.' }, { status: 404, headers });
    return Response.json({ draft: rowToWorkRecord(data as never) }, { headers });
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return Response.json({ code: 'INVALID_DRAFT', message: error.message, retryable: false }, { status: 400, headers });
    }
    return databaseError(error, headers);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const owner = await getDraftOwner(request);
  const headers = ownerCookieHeader(owner);
  const id = await draftId(context);
  if (!validId(id)) return Response.json({ message: '글 ID가 올바르지 않습니다.' }, { status: 400, headers });

  try {
    const { error } = await getDraftDatabase()
      .from('drafts')
      .delete()
      .eq('id', id)
      .eq('owner_key', owner.ownerKey);
    if (error) throw error;
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    return databaseError(error, headers);
  }
}
