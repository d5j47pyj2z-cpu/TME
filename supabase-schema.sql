-- TME Devis & Factures V3
-- À exécuter dans Supabase > SQL Editor.
create table if not exists public.tme_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tme_workspace enable row level security;

drop policy if exists "Users can read their own TME workspace" on public.tme_workspace;
create policy "Users can read their own TME workspace"
on public.tme_workspace for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own TME workspace" on public.tme_workspace;
create policy "Users can insert their own TME workspace"
on public.tme_workspace for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own TME workspace" on public.tme_workspace;
create policy "Users can update their own TME workspace"
on public.tme_workspace for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
