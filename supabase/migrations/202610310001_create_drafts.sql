create extension if not exists pgcrypto;

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  title text not null default '제목 없는 글',
  original_text text not null default '',
  target_length integer not null default 500 check (target_length between 1 and 10000),
  count_mode text not null default 'include-whitespace' check (count_mode in ('include-whitespace', 'exclude-whitespace')),
  protected_expressions jsonb not null default '[]'::jsonb,
  current_step text not null default 'input' check (current_step in ('input', 'protect', 'compare')),
  comparison_mode text not null default 'generate' check (comparison_mode in ('generate', 'reconcile')),
  revised_text text not null default '',
  candidates jsonb not null default '[]'::jsonb,
  manual_version text not null default '',
  selected_candidate_id text,
  final_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drafts_owner_updated_idx on public.drafts (owner_key, updated_at desc);

alter table public.drafts enable row level security;
revoke all on table public.drafts from anon, authenticated;
grant all on table public.drafts to service_role;

create or replace function public.set_drafts_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists drafts_set_updated_at on public.drafts;
create trigger drafts_set_updated_at
before update on public.drafts
for each row execute function public.set_drafts_updated_at();
