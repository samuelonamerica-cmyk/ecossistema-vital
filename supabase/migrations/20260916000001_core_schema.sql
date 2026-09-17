-- Ecossistema Vital — Fase 1: fundação + núcleo financeiro
-- Migration 20260916000001: schema núcleo (tabelas por usuário + dados macro globais)
-- Alvo: Supabase (PostgreSQL 15+). Owner dos dados: auth.users(id), ON DELETE CASCADE.
-- Apenas schema; sem seeds, sem dados de demonstração.

-- gen_random_uuid() precisa do pgcrypto (habilidade padrão no Supabase)
create extension if not exists "pgcrypto";

-- Trigger helper: updated_at automático
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) user_settings — configurações por usuário (moeda, idioma)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  currency    text        not null default 'USD',
  locale      text        not null default 'pt-BR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) transactions — receitas e despesas
-- ---------------------------------------------------------------------------
create table public.transactions (
  id             uuid          primary key default gen_random_uuid(),
  user_id        uuid          not null references auth.users(id) on delete cascade,
  type           text          not null check (type in ('receita', 'despesa')),
  description    text          not null,
  amount         numeric(12,2) not null check (amount > 0),
  category       text          not null,
  date           date          not null,
  payment_method text, -- 'credito','debito','zelle','dinheiro','outro'
  created_at     timestamptz   not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_user_created_idx on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) debts — dívidas (base do simulador avalanche/snowball)
-- ---------------------------------------------------------------------------
create table public.debts (
  id               uuid          primary key default gen_random_uuid(),
  user_id          uuid          not null references auth.users(id) on delete cascade,
  creditor         text          not null,
  balance          numeric(12,2) not null check (balance >= 0),
  annual_rate_pct  numeric(6,3)  not null check (annual_rate_pct >= 0),
  minimum_payment  numeric(12,2) not null check (minimum_payment >= 0),
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index debts_user_idx on public.debts (user_id);

-- ---------------------------------------------------------------------------
-- 4) goals — metas financeiras
-- ---------------------------------------------------------------------------
create table public.goals (
  id             uuid          primary key default gen_random_uuid(),
  user_id        uuid          not null references auth.users(id) on delete cascade,
  title          text          not null,
  target_amount  numeric(12,2),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  deadline       date,
  created_at     timestamptz   not null default now()
);

create index goals_user_idx on public.goals (user_id);

-- ---------------------------------------------------------------------------
-- 5) assistant_messages — histórico do Assistente Vital
-- ---------------------------------------------------------------------------
create table public.assistant_messages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null,
  created_at timestamptz not null default now()
);

create index assistant_messages_user_created_idx on public.assistant_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 6) debate_messages — espaço de relatos do usuário
-- ---------------------------------------------------------------------------
-- Decisão (Fase 1): esta tabela existe para relatos/denúncias do próprio
-- usuário (conteúdo dele, dono = user_id). Moderação/fila pública ficam
-- para a Fase 2, quando o modelo de visibilidade for definido.
create table public.debate_messages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);

create index debate_messages_user_created_idx on public.debate_messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 7) recommendation_decisions — decisões do usuário sobre recomendações
--    ("Relatório Porquê": aceitou/ignorou/aditou cada recomendação)
-- ---------------------------------------------------------------------------
create table public.recommendation_decisions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  decision   jsonb       not null, -- { recommendation_id, action: 'aceita'|'ignorada'|..., reason }
  created_at timestamptz not null default now()
);

create index recommendation_decisions_user_idx on public.recommendation_decisions (user_id);

-- ---------------------------------------------------------------------------
-- 8) receipt_drafts — rascunhos de notas fiscais (foto no Storage privado)
-- ---------------------------------------------------------------------------
-- Fluxo honesto da Fase 1: o usuário anexa a foto da nota e o bot coleta os
-- campos manualmente na conversa; sem OCR. photo_path aponta para o objeto
-- no bucket privado 'receipts'. fields guarda o que foi extraído/confirmado.
create table public.receipt_drafts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  photo_path text,
  status     text        not null default 'manual',
  fields     jsonb,
  created_at timestamptz not null default now()
);

create index receipt_drafts_user_idx on public.receipt_drafts (user_id);

-- ---------------------------------------------------------------------------
-- 9) macro_indicator_observations — observações de indicadores macro (BCB)
-- ---------------------------------------------------------------------------
-- Dado de referência GLOBAL: não pertence a nenhum usuário. Alimenta o
-- Painel Macro (Selic, IPCA mensal, USD/BRL). Escrita apenas via service_role
-- (Edge Function), leitura aberta a usuários autenticados.
create table public.macro_indicator_observations (
  id          bigserial   primary key,
  indicator   text        not null, -- 'selic','ipca_mensal','usd_brl'
  value       numeric     not null,
  observed_at timestamptz not null, -- data de referência do indicador
  source      text        not null default 'BCB',
  fetched_at  timestamptz not null default now()
);

create index macro_obs_indicator_fetched_idx
  on public.macro_indicator_observations (indicator, fetched_at desc);

-- ---------------------------------------------------------------------------
-- 10) macro_refresh_state — controle do cache de 6h por indicador
-- ---------------------------------------------------------------------------
create table public.macro_refresh_state (
  indicator     text        primary key, -- 'selic','ipca_mensal','usd_brl'
  last_fetch_at timestamptz,
  last_status   text
);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------
create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.handle_updated_at();

create trigger debts_updated_at
  before update on public.debts
  for each row execute function public.handle_updated_at();
