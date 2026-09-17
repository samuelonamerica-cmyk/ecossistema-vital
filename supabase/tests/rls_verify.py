#!/usr/bin/env python3
"""Fase 1 Ecossistema Vital — verificação de verdade das migrations + RLS."""
import psycopg2, sys

URI = open("/tmp/pgtest_uri.txt").read().strip()
UA = "11111111-1111-1111-1111-111111111111"  # usuário A
UB = "22222222-2222-2222-2222-222222222222"  # usuário B

results = []
def check(name, cond, detail=""):
    results.append((name, cond, detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))

admin = psycopg2.connect(URI)
admin.autocommit = True
c = admin.cursor()
c.execute("drop schema if exists public cascade; create schema public")
c.execute("drop schema if exists auth cascade; drop schema if exists storage cascade")

print("== 1. Stubs auth/storage (Supabase) ==")
c.execute("create schema if not exists auth")
c.execute("create table if not exists auth.users (id uuid primary key)")
c.execute("""create or replace function auth.uid() returns uuid
             language sql stable as $$
               select nullif(current_setting('app.current_user_id', true), '')::uuid
             $$""")
c.execute("create schema if not exists storage")
c.execute("create table if not exists storage.buckets (id text primary key, name text, public boolean)")
c.execute("""create table if not exists storage.objects (
               id uuid primary key default gen_random_uuid(),
               bucket_id text, name text)""")
# No Supabase real, storage.objects já vem com RLS habilitado; no stub, habilitar:
c.execute("alter table storage.objects enable row level security")
c.execute("""create or replace function storage.foldername(name text) returns text[]
             language plpgsql immutable as $$
             declare parts text[] := string_to_array(name, '/');
             begin
               if array_length(parts,1) is null or array_length(parts,1) < 2 then return '{}'::text[]; end if;
               return parts[1:array_length(parts,1)-1];
             end $$""")
c.execute("do $$ begin if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$")
# pgcrypto não existe no pgserver embarcado (no Supabase real, existe).
# Adaptação SOMENTE do teste: stub de gen_random_uuid() + ignora a linha do extension.
c.execute("""create or replace function public.gen_random_uuid() returns uuid
             language sql as $$ select md5(random()::text || clock_timestamp()::text)::uuid $$""")
check("stubs criados", True)

print("== 2. Aplicar migrations em ordem ==")
import glob, re
files = sorted(glob.glob("/home/hatch/workspace/ecossistema-vital-prod/supabase/migrations/20260916*.sql"))
for f in files:
    try:
        sql = open(f).read()
        sql = re.sub(r'create extension if not exists "pgcrypto";', '-- [teste local] pgcrypto indisponível no pgserver; stub acima', sql)
        c.execute(sql)
        print(f"  aplicada: {f.split('/')[-1]}")
    except Exception as e:
        print(f"  ERRO em {f}: {e}"); sys.exit(1)
check("migrations aplicadas em ordem", True, f"{len(files)} arquivos")

print("== 3. Grants estilo Supabase + usuários de teste ==")
c.execute("grant usage on schema public, auth, storage to authenticated")
c.execute("grant all on all tables in schema public to authenticated")
c.execute("grant usage, select on all sequences in schema public to authenticated")
c.execute("grant all on storage.objects to authenticated")
c.execute("grant select on storage.buckets to authenticated")
c.execute("insert into auth.users(id) values (%s), (%s) on conflict do nothing", (UA, UB))
check("grants + 2 usuários", True)

def as_user(uid):
    """Nova conexão como role authenticated, com app.current_user_id=uid."""
    conn = psycopg2.connect(URI); conn.autocommit = True
    cur = conn.cursor()
    cur.execute("set role authenticated")
    cur.execute("set app.current_user_id = %s", (uid,))
    return conn, cur

print("== 4. RLS: isolamento entre usuários ==")
# A insere a própria transação
ca, a = as_user(UA)
a.execute("insert into transactions(user_id,type,description,amount,category,date) values (%s,'despesa','Wawa',8.87,'alimentacao','2026-09-15') returning id", (UA,))
tid_a = a.fetchone()[0]
check("A insere própria transação", True, f"id={tid_a}")

# A tenta inserir como B -> bloqueado
try:
    a.execute("insert into transactions(user_id,type,description,amount,category,date) values (%s,'despesa','X',1.00,'y','2026-09-15')", (UB,))
    check("A NÃO insere transação de B", False, "insert passou!")
except psycopg2.errors.InsufficientPrivilege as e:
    check("A NÃO insere transação de B", True, f"bloqueado: {str(e).splitlines()[0][:80]}")
ca.close()

# superuser planta linha de B (bypassa RLS)
c.execute("insert into transactions(user_id,type,description,amount,category,date) values (%s,'receita','Salario',160.00,'renda','2026-09-15')", (UB,))

# A lê: só vê a própria
ca, a = as_user(UA)
a.execute("select count(*), sum(case when user_id=%s then 1 else 0 end) from transactions", (UA,))
n, own = a.fetchone()
check("A lê SOMENTE as próprias linhas", n == 1 and own == 1, f"linhas visíveis={n}")

# A tenta UPDATE na linha de B -> 0 linhas (invisível)
a.execute("update transactions set description='hack' where user_id=%s", (UB,))
check("A NÃO atualiza linha de B", a.rowcount == 0, f"rowcount={a.rowcount}")
# A tenta DELETE na linha de B -> 0 linhas
a.execute("delete from transactions where user_id=%s", (UB,))
check("A NÃO apaga linha de B", a.rowcount == 0, f"rowcount={a.rowcount}")
ca.close()

# B lê: só vê a própria
cb, b = as_user(UB)
b.execute("select count(*) from transactions")
check("B lê SOMENTE as próprias linhas", b.fetchone()[0] == 1, "1 linha visível")
# B tenta ler linha específica de A
b.execute("select * from transactions where id=%s", (tid_a,))
check("B NÃO lê linha específica de A", b.fetchone() is None, "0 linhas")
cb.close()

print("== 5. Demais tabelas de usuário (spot check) ==")
for tbl, cols, vals in [
    ("debts", "(user_id,creditor,balance,annual_rate_pct,minimum_payment)", "'Cartao',500.00,24.900,25.00"),
    ("goals", "(user_id,title,target_amount)", "'Reserva',1000.00"),
    ("assistant_messages", "(user_id,role,content)", "'user','oi'"),
    ("debate_messages", "(user_id,content)", "'relato teste'"),
    ("recommendation_decisions", "(user_id,decision)", "'{\"a\":1}'"),
    ("receipt_drafts", "(user_id,photo_path,status)", "'x.jpg','manual'"),
    ("user_settings", "(user_id,currency)", "'BRL'"),
]:
    ca, a = as_user(UA)
    a.execute(f"insert into {tbl}{cols} values (%s,{vals})", (UA,))
    a.execute(f"select count(*) from {tbl}")
    own_n = a.fetchone()[0]
    # planta linha de B via admin e confirma que A não a vê
    c.execute(f"insert into {tbl}{cols} values (%s,{vals})", (UB,))
    a.execute(f"select count(*) from {tbl}")
    vis_n = a.fetchone()[0]
    cb, b = as_user(UB)
    b.execute(f"select count(*) from {tbl}")
    b_n = b.fetchone()[0]
    ok = (vis_n == own_n) and (b_n >= 1)
    check(f"{tbl}: A escreve a sua, não vê a de B; B vê a sua", ok, f"A vê {vis_n}, B vê {b_n}")
    ca.close(); cb.close()

print("== 6. Tabelas macro: leitura sim, escrita não ==")
c.execute("insert into macro_indicator_observations(indicator,value,observed_at) values ('selic',14.00,'2026-09-16')")
c.execute("insert into macro_refresh_state(indicator,last_fetch_at,last_status) values ('selic',now(),'ok')")
for uid, nm in [(UA,"A"),(UB,"B")]:
    cu, u = as_user(uid)
    u.execute("select count(*) from macro_indicator_observations")
    r1 = u.fetchone()[0]
    u.execute("select count(*) from macro_refresh_state")
    r2 = u.fetchone()[0]
    blocked = True; msg=""
    try:
        u.execute("insert into macro_indicator_observations(indicator,value,observed_at) values ('selic',99.99,now())")
        blocked = False
    except psycopg2.errors.InsufficientPrivilege as e:
        msg = str(e).splitlines()[0][:70]
    check(f"macro: {nm} LÊ ambas, mas NÃO ESCREVE observations", r1>=1 and r2>=1 and blocked, f"leitura ok ({r1},{r2}); escrita bloqueada: {msg}")
    try:
        u.execute("update macro_refresh_state set last_status='x' where indicator='selic'")
        upd_blocked = (u.rowcount == 0)
    except psycopg2.errors.InsufficientPrivilege:
        upd_blocked = True
    check(f"macro: {nm} NÃO ALTERA refresh_state", upd_blocked)
    cu.close()

print("== 7. Storage receipts: isolamento por pasta ==")
ca, a = as_user(UA)
a.execute("insert into storage.objects(bucket_id,name) values ('receipts',%s)", (UA + "/nota-wawa.jpg",))
check("A faz upload na própria pasta", True)
try:
    a.execute("insert into storage.objects(bucket_id,name) values ('receipts',%s)", (UB + "/evil.jpg",))
    check("A NÃO faz upload na pasta de B", False, "insert passou!")
except psycopg2.errors.InsufficientPrivilege as e:
    check("A NÃO faz upload na pasta de B", True, f"bloqueado: {str(e).splitlines()[0][:70]}")
a.execute("select count(*) from storage.objects")
n=a.fetchone()[0]; check("A lista SOMENTE os próprios objetos", n == 1, f"{n} objeto(s) visível(is)")
ca.close()
cb, b = as_user(UB)
b.execute("select count(*) from storage.objects")
n=b.fetchone()[0]; check("B NÃO vê objetos de A", n == 0, f"{n} objeto(s) visível(is)")
cb.close()

print()
fails = [r for r in results if not r[1]]
print(f"RESULTADO: {len(results)-len(fails)}/{len(results)} checks passaram")
sys.exit(1 if fails else 0)
