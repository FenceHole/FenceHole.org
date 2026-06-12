-- FenceHole Hub: fix RLS infinite-recursion on "Team ..." policies
--
-- The original "Team ..." policies checked
--   exists (select 1 from profiles where id=auth.uid() and role='team')
-- directly inside other policies on `profiles` (and tables that reference
-- it). Because that subquery selects from `profiles`, Postgres re-applies
-- the same RLS policy to the subquery, which contains the same subquery
-- again -> ERROR 42P17: infinite recursion detected in policy for relation
-- "profiles". This broke login (any query against `profiles` errored, and
-- the app silently treated that as role='pending').
--
-- Fix: a SECURITY DEFINER helper function that checks the caller's role
-- while bypassing RLS, used by every "Team ..." policy instead.
--
-- This script is idempotent (safe to run multiple times) and can be run
-- directly against an already-provisioned database that ran the old
-- schema.sql / hq-schema.sql / hq-agents-v2-schema.sql. Fresh installs
-- using the current schema files won't need this — it's kept here for
-- reference and recovery.

create or replace function public.is_team_member()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'team'
  );
$$;

drop policy if exists "Team sees all" on public.profiles;
create policy "Team sees all" on public.profiles
  for select using (public.is_team_member() or auth.uid() = id);

drop policy if exists "Team can view" on public.access_requests;
create policy "Team can view" on public.access_requests
  for select using (public.is_team_member());

drop policy if exists "Team full access contacts" on public.contacts;
create policy "Team full access contacts" on public.contacts
  for all using (public.is_team_member());

drop policy if exists "Team full access deals" on public.deals;
create policy "Team full access deals" on public.deals
  for all using (public.is_team_member());

drop policy if exists "Team full access notes" on public.notes;
create policy "Team full access notes" on public.notes
  for all using (public.is_team_member());

drop policy if exists "Team full access tasks" on public.tasks;
create policy "Team full access tasks" on public.tasks
  for all using (public.is_team_member());

drop policy if exists "Team full access content" on public.content_ideas;
create policy "Team full access content" on public.content_ideas
  for all using (public.is_team_member());

drop policy if exists "Team sees all projects" on public.client_projects;
create policy "Team sees all projects" on public.client_projects
  for all using (public.is_team_member());

drop policy if exists "Team sees all messages" on public.client_messages;
create policy "Team sees all messages" on public.client_messages
  for all using (public.is_team_member());

drop policy if exists "Team full access deal_offers" on public.deal_offers;
create policy "Team full access deal_offers" on public.deal_offers
  for all using (public.is_team_member());

drop policy if exists "Team full access agent_drafts" on public.agent_drafts;
create policy "Team full access agent_drafts" on public.agent_drafts
  for all using (public.is_team_member());

drop policy if exists "Team full access agent_memory" on public.agent_memory;
create policy "Team full access agent_memory" on public.agent_memory
  for all using (public.is_team_member());

drop policy if exists "Team full access agent_conversations" on public.agent_conversations;
create policy "Team full access agent_conversations" on public.agent_conversations
  for all using (public.is_team_member());
