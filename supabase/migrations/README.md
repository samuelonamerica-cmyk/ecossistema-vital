# Migrations — Ecossistema Vital (Fase 1: fundação + núcleo financeiro)

## Arquivos (aplicar em ordem)

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 1 | `20260916000001_core_schema.sql` | 10 tabelas + índices + trigger `updated_at` |
| 2 | `20260916000002_rls.sql` | RLS habilitado + policies |
| 3 | `20260916000003_storage.sql` | Bucket privado `receipts` + policies do Storage |

**Convenções:** apenas schema, sem seeds/dados de demonstração. Owner dos dados =
`auth.users(id)` com `ON DELETE CASCADE` (apagar o usuário apaga tudo — LGPD por
construção). `gen_random_uuid()` via extensão `pgcrypto`.

## Decisões de schema

- **`user_settings`** — PK é o próprio `user_id` (1:1 com o usuário). Padrões
  `currency='USD'`, `locale='pt-BR'` (usuário mora nos EUA, idioma PT-BR).
- **`transactions`** — `type` restrito a `receita`/`despesa`; `amount > 0`
  (valores sempre positivos; o sinal vem do `type`). Índices em
  `(user_id, date desc)` e `(user_id, created_at)` para as consultas do painel.
- **`debts`** — `annual_rate_pct numeric(6,3)` (juros % a.a., ex.: 14.250);
  `balance` e `minimum_payment` com check `>= 0`. Base do simulador
  avalanche/snowball (lógica determinística, sem IA).
- **`goals`** — `target_amount` opcional; `current_amount` default 0.
- **`assistant_messages`** — `role` restrito a `user`/`assistant`. Espelha o
  histórico do Assistente Vital do MVP.
- **`debate_messages`** — Fase 1: relatos/denúncias do próprio usuário, visível
  só para ele. Fila pública/moderada fica para a **Fase 2**, quando o modelo de
  visibilidade for definido (não expor conteúdo de um usuário a outro sem regra).
- **`recommendation_decisions`** — `decision jsonb` guarda o que o usuário
  decidiu sobre cada recomendação do Relatório Porquê
  (`{recommendation_id, action, reason}`), alimentando o aprendizado futuro.
- **`receipt_drafts`** — **fluxo manual honesto na Fase 1 (sem OCR)**:
  `photo_path` aponta para o objeto no bucket privado `receipts`;
  `fields jsonb` guarda os campos confirmados na conversa;
  `status` default `'manual'`.
- **`macro_indicator_observations`** — dado de referência **global** (não por
  usuário): observações de `selic`, `ipca_mensal`, `usd_brl` com
  `observed_at` (data de referência) e `fetched_at` (quando foi coletado).
  Alimenta o Painel Macro; **não** alimenta o texto do Relatório Porquê
  (regra herdada do MVP).
- **`macro_refresh_state`** — controle do cache de 6h por indicador
  (`last_fetch_at`, `last_status`); lido pela Edge Function antes de buscar o BCB.

## Decisões de RLS

- Todas as 8 tabelas de usuário: `FOR ALL TO authenticated` com
  `USING (auth.uid() = user_id)` + `WITH CHECK (auth.uid() = user_id)`.
  Cada usuário só toca as próprias linhas — leitura, escrita, update, delete.
- Tabelas macro: apenas policy de `SELECT TO authenticated USING (true)`.
  **Sem policy de escrita** → INSERT/UPDATE/DELETE de cliente autenticado são
  negados por default-deny; a escrita é feita pela Edge Function com
  `service_role` (bypassa RLS por definição).
- Storage `receipts` (privado, `public=false`): 4 policies
  (select/insert/update/delete) exigindo
  `(storage.foldername(name))[1] = auth.uid()::text` — cada usuário só acessa
  objetos sob `<seu-user_id>/...`.

## O que ficou para depois (não nesta fase)

- Fila pública/moderada de `debate_messages` (Fase 2).
- OCR de notas fiscais (decisão do usuário: extração automática no servidor;
  quando implementada, `receipt_drafts.status` ganha valores como
  `'ocr_ok'`/`'ocr_falhou'`).
- `payment_method` hoje é texto livre documentado
  (`credito|debito|zelle|dinheiro|outro`); virar enum/check só se necessário.
