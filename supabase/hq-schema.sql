-- FenceHole HQ: Deal Desk + agent approval queue
create table if not exists public.deal_offers (
  id uuid default gen_random_uuid() primary key,
  brand_name text not null,
  source text,
  offer_text text not null,
  value numeric,
  status text not null default 'new' check (status in ('new','assessed','approved','declined','done')),
  priority text check (priority in ('low','medium','high')),
  nessie_assessment text,
  created_at timestamptz default now()
);
alter table public.deal_offers enable row level security;
create policy "Team full access deal_offers" on deal_offers for all using (public.is_team_member());

create table if not exists public.agent_drafts (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deal_offers(id) on delete cascade,
  kind text not null default 'reply',
  title text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz default now()
);
alter table public.agent_drafts enable row level security;
create policy "Team full access agent_drafts" on agent_drafts for all using (public.is_team_member());
