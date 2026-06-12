-- FenceHole HQ v2: persistent memory, conversation log (WhatsApp etc.),
-- and extra columns on agent_drafts for channel-sourced drafts.
create table if not exists public.agent_memory (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null default 'nessie-chief-of-staff',
  category text not null default 'general',
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.agent_memory enable row level security;
create policy "Team full access agent_memory" on agent_memory for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));

create table if not exists public.agent_conversations (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null default 'nessie-chief-of-staff',
  channel text not null,
  external_id text,
  role text not null check (role in ('user','assistant')),
  content text not null,
  media_url text,
  created_at timestamptz default now()
);
alter table public.agent_conversations enable row level security;
create policy "Team full access agent_conversations" on agent_conversations for all using (exists (select 1 from profiles where id=auth.uid() and role='team'));

alter table public.agent_drafts add column if not exists channel text;
alter table public.agent_drafts add column if not exists external_ref text;
alter table public.agent_drafts add column if not exists media_url text;
alter table public.agent_drafts add column if not exists payload jsonb default '{}';
alter table public.agent_drafts alter column deal_id drop not null;
