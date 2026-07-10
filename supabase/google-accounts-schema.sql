-- Per-user Google (Gmail + Calendar) OAuth token store for the Hub.
-- Applied to the live project as migration `google_accounts`. Safe to re-run.

create table if not exists public.google_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.google_accounts enable row level security;

-- Each user can see and manage only their own connection row. Token columns
-- are only ever read server-side; the browser never receives them.
drop policy if exists "own google account" on public.google_accounts;
create policy "own google account" on public.google_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep anon from discovering the token store via the auto GraphQL/REST API.
revoke select on public.google_accounts from anon;
