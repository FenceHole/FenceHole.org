-- Team Chat + Daily To-Do for the Hub.
-- Safe to re-run. Relies on public.is_team_member() (already defined).

-- ---------- Team Chat ----------
create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Team',
  role text not null default 'user',      -- 'user' | 'nessie'
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.team_messages enable row level security;

drop policy if exists "team reads chat" on public.team_messages;
create policy "team reads chat" on public.team_messages
  for select using (public.is_team_member());

drop policy if exists "team posts chat" on public.team_messages;
create policy "team posts chat" on public.team_messages
  for insert with check (public.is_team_member());

-- Live updates so new messages appear without a refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end $$;

-- ---------- Daily To-Do ----------
create table if not exists public.daily_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  due_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  source text not null default 'hub',      -- 'hub' | 'nessie'
  created_at timestamptz not null default now()
);

alter table public.daily_todos enable row level security;

drop policy if exists "team manages todos" on public.daily_todos;
create policy "team manages todos" on public.daily_todos
  for all using (public.is_team_member()) with check (public.is_team_member());
