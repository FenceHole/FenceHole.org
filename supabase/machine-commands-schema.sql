-- Nessie's bridge to Chris's Mac.
--
-- The Hub runs in a datacenter and cannot reach a laptop, so the Mac agent
-- polls outward for work. Commands land here as 'pending' and the agent will
-- ONLY execute rows that a human has moved to 'approved'.

create table if not exists public.machine_commands (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- notify | open_url | open_app | read_file | write_file | applescript
  payload jsonb not null default '{}'::jsonb,
  reason text,                        -- why Nessie wants it, shown at approval time
  status text not null default 'pending'
    check (status in ('pending','approved','running','done','failed','declined')),
  result text,
  requested_by text not null default 'nessie',
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.machine_commands enable row level security;

drop policy if exists "team manages machine commands" on public.machine_commands;
create policy "team manages machine commands" on public.machine_commands
  for all using (public.is_team_member()) with check (public.is_team_member());

create index if not exists machine_commands_status_idx
  on public.machine_commands (status, created_at);
