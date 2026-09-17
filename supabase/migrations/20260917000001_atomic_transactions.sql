-- Ecossistema Vital — Fase 1: correções pré-deploy (pacote 1/4, item 1)
-- Migration 20260917000001: anti-duplicata ATÔMICA de transações
--
-- Problema corrigido: o fluxo check-then-insert (SELECT de lançamentos
-- recentes + INSERT em chamadas separadas, em app/transacoes/actions.ts)
-- permitia duplicata quando dois lançamentos iguais chegavam ao mesmo tempo,
-- e duas conversões simultâneas do mesmo rascunho (receipt_drafts) podiam
-- gerar dois lançamentos.
--
-- Correção: duas RPCs SECURITY DEFINER que executam checagem + inserção
-- dentro de UMA transação, serializadas por advisory lock do Postgres:
--   - trava por usuário   -> elimina a corrida check-then-insert;
--   - trava por rascunho  -> elimina a conversão dupla do mesmo rascunho.
-- Ordem de travas fixa (usuário -> rascunho): nunca causa deadlock.
--
-- Regra de negócio (idêntica à de lib/finance/antiDuplicate.ts):
--   descrição normalizada + categoria iguais, MESMO DIA no calendário
--   (coluna `date`) e created_at dentro de 5 minutos.
-- RLS: as funções conferem auth.uid() = user_id explicitamente antes de
-- qualquer escrita (equivalente à policy das tabelas de usuário); nenhum
-- outro usuário tem as linhas tocadas.

-- unaccent: normalização de acentos no servidor (disponível no Supabase).
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Normalização de texto (espelha normalizeDescription/normalizeCategory de
-- lib/finance/antiDuplicate.ts): minúsculas, sem acentos, trim, espaços
-- colapsados. Aplicada dos dois lados da comparação, então a regra é
-- consistente para lançamentos antigos e novos.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_tx_description(value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(trim(unaccent(lower(value))), '\s+', ' ', 'g')
$$;

create or replace function public.normalize_tx_category(value text)
returns text
language sql
immutable
as $$
  select lower(trim(value))
$$;

-- ---------------------------------------------------------------------------
-- create_transaction_if_unique — inserção atômica com anti-duplicata.
-- Retorna jsonb: {"ok": true, "id": "<uuid>"} ou
--                {"ok": false, "reason": "duplicado"}.
-- ---------------------------------------------------------------------------
create or replace function public.create_transaction_if_unique(
  p_user_id        uuid,
  p_type           text,
  p_description    text,
  p_amount         numeric,
  p_category       text,
  p_date           date,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_dup_id uuid;
  v_new_id uuid;
begin
  -- Equivalente à policy RLS auth.uid() = user_id: só o próprio usuário
  -- insere lançamentos para si.
  v_uid := auth.uid();
  if v_uid is null or v_uid <> p_user_id then
    raise exception 'acesso negado: operacao permitida apenas para o proprio usuario';
  end if;

  if p_type not in ('receita', 'despesa') then
    raise exception 'tipo de lancamento invalido';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'descricao obrigatoria';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'valor deve ser maior que zero';
  end if;
  if p_category is null or btrim(p_category) = '' then
    raise exception 'categoria obrigatoria';
  end if;
  if p_date is null then
    raise exception 'data obrigatoria';
  end if;

  -- Trava transacional por usuário: serializa checagem + inserção e elimina
  -- a corrida check-then-insert entre requisições simultâneas.
  perform pg_advisory_xact_lock(hashtext('vital_tx:' || p_user_id::text));

  -- Regra anti-duplicata: descrição normalizada + categoria iguais, mesmo
  -- dia no calendário e created_at dentro de 5 minutos.
  select t.id
    into v_dup_id
  from public.transactions t
  where t.user_id = p_user_id
    and public.normalize_tx_description(t.description)
        = public.normalize_tx_description(p_description)
    and public.normalize_tx_category(t.category)
        = public.normalize_tx_category(p_category)
    and t.date = p_date
    and t.created_at >= now() - interval '5 minutes'
  limit 1;

  if v_dup_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
  end if;

  insert into public.transactions
    (user_id, type, description, amount, category, date, payment_method)
  values
    (p_user_id, p_type, p_description, p_amount, p_category, p_date, p_payment_method)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'id', v_new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- convert_receipt_draft — conversão atômica de rascunho de nota fiscal.
-- Claim atômico do rascunho (UPDATE ... WHERE status='manual'): duas
-- conversões simultâneas do mesmo rascunho -> só uma vence; a outra recebe
-- "rascunho_ja_convertido". Aplica a mesma anti-duplicata antes de inserir.
-- Retorna jsonb: {"ok": true, "id": "<uuid>"} ou
--                {"ok": false, "reason": "duplicado" | "rascunho_ja_convertido"
--                                        | "rascunho_nao_encontrado"}.
-- ---------------------------------------------------------------------------
create or replace function public.convert_receipt_draft(
  p_draft_id       uuid,
  p_description    text,
  p_amount         numeric,
  p_category       text,
  p_date           date,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid;
  v_claimed uuid;
  v_dup_id  uuid;
  v_new_id  uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'acesso negado: usuario nao autenticado';
  end if;

  if p_description is null or btrim(p_description) = '' then
    raise exception 'descricao obrigatoria';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'valor deve ser maior que zero';
  end if;
  if p_category is null or btrim(p_category) = '' then
    raise exception 'categoria obrigatoria';
  end if;
  if p_date is null then
    raise exception 'data obrigatoria';
  end if;

  -- Ordem de travas fixa (usuário -> rascunho): serializa sem deadlock.
  perform pg_advisory_xact_lock(hashtext('vital_tx:' || v_uid::text));
  perform pg_advisory_xact_lock(hashtext('vital_draft:' || p_draft_id::text));

  -- Anti-duplicata ANTES do claim (mesma regra do create_transaction_if_unique).
  select t.id
    into v_dup_id
  from public.transactions t
  where t.user_id = v_uid
    and public.normalize_tx_description(t.description)
        = public.normalize_tx_description(p_description)
    and public.normalize_tx_category(t.category)
        = public.normalize_tx_category(p_category)
    and t.date = p_date
    and t.created_at >= now() - interval '5 minutes'
  limit 1;

  if v_dup_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
  end if;

  -- Claim atômico: só converte quem ainda estiver com status 'manual'.
  update public.receipt_drafts d
  set status = 'converted',
      fields = jsonb_build_object(
        'estabelecimento',  p_description,
        'data',             p_date,
        'valor_total',      p_amount,
        'categoria',        p_category,
        'forma_pagamento',  p_payment_method
      )
  where d.id = p_draft_id
    and d.user_id = v_uid
    and d.status = 'manual'
  returning d.id into v_claimed;

  if v_claimed is null then
    -- Distingue "não existe / não é meu" de "outra requisição converteu".
    perform 1
    from public.receipt_drafts d
    where d.id = p_draft_id
      and d.user_id = v_uid;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'rascunho_nao_encontrado');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'rascunho_ja_convertido');
  end if;

  insert into public.transactions
    (user_id, type, description, amount, category, date, payment_method)
  values
    (v_uid, 'despesa', p_description, p_amount, p_category, p_date, p_payment_method)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'id', v_new_id);
end;
$$;

-- Execução restrita a usuários autenticados (as funções reforçam
-- auth.uid() = user_id internamente; SECURITY DEFINER não expõe RLS).
grant execute on function public.normalize_tx_description(text) to authenticated;
grant execute on function public.normalize_tx_category(text) to authenticated;
grant execute on function public.create_transaction_if_unique(uuid, text, text, numeric, text, date, text) to authenticated;
grant execute on function public.convert_receipt_draft(uuid, text, numeric, text, date, text) to authenticated;
