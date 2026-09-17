-- Ecossistema Vital — Fase 1
-- Migration 20260916000003: Storage privado 'receipts' (fotos de notas fiscais)
-- Convenção de caminho: <user_id>/<arquivo> — ex.: 11111111-.../nota-20260916.jpg
-- Cada usuário só enxerga/escreve objetos dentro da própria pasta.

-- Bucket privado (sem acesso público)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Leitura: só objetos da pasta do próprio usuário
create policy "receipts_read_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Upload: só na própria pasta
create policy "receipts_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Atualização (renomear/substituir): só na própria pasta
create policy "receipts_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Exclusão: só na própria pasta
create policy "receipts_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
