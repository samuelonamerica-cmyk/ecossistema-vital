-- Ecossistema Vital — Fase 1
-- Migration 20260916000002: Row Level Security (RLS)
-- Regra: cada usuário autenticado acessa SOMENTE as próprias linhas.
-- Tabelas macro: leitura para authenticated; escrita apenas via service_role
-- (nenhuma policy de escrita para authenticated — service_role bypassa RLS).

-- ============================ tabelas por usuário ===========================

alter table public.user_settings           enable row level security;
alter table public.transactions            enable row level security;
alter table public.debts                   enable row level security;
alter table public.goals                   enable row level security;
alter table public.assistant_messages      enable row level security;
alter table public.debate_messages         enable row level security;
alter table public.recommendation_decisions enable row level security;
alter table public.receipt_drafts          enable row level security;

-- user_settings
create policy "user_settings_own"
  on public.user_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transactions
create policy "transactions_own"
  on public.transactions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- debts
create policy "debts_own"
  on public.debts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- goals
create policy "goals_own"
  on public.goals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- assistant_messages
create policy "assistant_messages_own"
  on public.assistant_messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- debate_messages (Fase 1: visibilidade restrita ao próprio usuário; público na Fase 2)
create policy "debate_messages_own"
  on public.debate_messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- recommendation_decisions
create policy "recommendation_decisions_own"
  on public.recommendation_decisions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- receipt_drafts
create policy "receipt_drafts_own"
  on public.receipt_drafts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================ tabelas macro (globais) =======================

alter table public.macro_indicator_observations enable row level security;
alter table public.macro_refresh_state          enable row level security;

-- leitura para qualquer usuário autenticado; SEM policy de escrita ->
-- INSERT/UPDATE/DELETE de authenticated são negados (RLS default-deny).
create policy "macro_observations_read"
  on public.macro_indicator_observations
  for select
  to authenticated
  using (true);

create policy "macro_refresh_state_read"
  on public.macro_refresh_state
  for select
  to authenticated
  using (true);

-- Nota: a escrita dessas tabelas é feita no servidor Next.js com service_role
-- (lib/supabase/serviceRole.ts), que bypassa o RLS por definição do Supabase.
-- Não criar policies de escrita para authenticated.
