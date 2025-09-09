-- Ensure join_tokens schema has required columns and indexes
alter table if exists public.join_tokens
  add column if not exists token text,
  add column if not exists event_id uuid references public.events(id),
  add column if not exists participant_id uuid references public.participants(id),
  add column if not exists expires_at timestamptz,
  add column if not exists used_at timestamptz;

create unique index if not exists join_tokens_token_unique on public.join_tokens(token);
create index if not exists join_tokens_event on public.join_tokens(event_id);
