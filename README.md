# Ecossistema Vital — Aplicação de Produção (Fase 1)

Plataforma de inteligência financeira pessoal. Diferencial central: não só
mostrar **quanto** você gastou, mas explicar **por que isso aconteceu** e
prescrever **qual decisão melhora sua situação**.

> Projeto pessoal de Samuel Ferreira de Queiroz. Este repositório é a
> reconstrução do MVP como app de produção real. O MVP original (artifact
> privado no Muse) **não é tocado** por este código — nenhum dado de usuário
> existente foi migrado e nenhum dado de demonstração/seed foi criado.

---

## Stack

| Camada        | Tecnologia                              |
| ------------- | --------------------------------------- |
| Framework     | Next.js 16 (App Router) + React 19      |
| Linguagem     | TypeScript (modo estrito)               |
| Estilos       | Tailwind CSS v4 (tokens via `@theme`)   |
| Banco + Auth  | Supabase (PostgreSQL + Auth + RLS)      |
| Hospedagem    | Vercel (plano Hobby)                    |
| Custo mensal  | **R$ 0,00** (ver restrição abaixo)      |

Identidade visual: **verde-esmeralda** (`#047857`, primária) + **dourada**
(`#C9A227`, acento). Tokens definidos em `app/globals.css` (`--color-vital-*`).
UI 100% em PT-BR (`<html lang="pt-BR">`); moeda padrão **USD**.

Estrutura relevante:

```
app/                    # Rotas (App Router): layout base + páginas
  layout.tsx            # Header (logo + nav), rodapé, lang="pt-BR"
  page.tsx              # Página inicial
  visao/ transacoes/ relatorio-porque/ dividas/ macro/ login/ cadastro/
lib/
  env.ts                # Fail-fast: valida as 4 env vars obrigatórias no boot
  desafio.ts            # Desafio matemático anti-bot (HMAC via APP_SECRET)
  supabase/             # Clientes browser/server + middleware de sessão
  why/ finance/ macro/  # Motor do Relatório Porquê, simulador de dívidas, BCB
instrumentation.ts      # Hook de inicialização (chama o fail-fast de env)
proxy.ts                # Guarda de rotas (proxy do Next.js 16): sessão + auth
public/logo.png         # Logo oficial "Vida que cresce"
supabase/migrations/    # Migrações SQL (core_schema, RLS, storage, transações atômicas)
supabase/tests/         # Evidências de verificação (RLS 25/25)
```

## Restrição dura: custo R$ 0

Decisão do fundador, não negociável nesta fase. É proibido introduzir:

- APIs pagas de qualquer natureza (incluindo OpenAI / qualquer LLM externo);
- Firebase ou outro BaaS além do Supabase Free;
- Integrações bancárias reais (Open Banking / agregadores pagos);
- Qualquer dependência com custo recorrente ou por uso.

Todo o núcleo da Fase 1 roda em **free tiers**: Vercel Hobby + Supabase Free.
O primeiro custo real só aparece com tração (ex.: Supabase Pro ~US$ 25/mês),
e qualquer proposta de custo volta para aprovação do Samuel antes.

## Deploy do zero (Vercel + Supabase)

### 1. Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto Free.
2. Em **Project Settings > API**, copie: `Project URL`, `anon public key`
   e `service_role key` (esta última, secreta).
3. Rode as migrações em `supabase/migrations/` (em ordem numérica) pelo SQL
   Editor ou pela CLI (`supabase db push`).

### 2. Vercel

1. Suba este repositório para o GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório. A
   Vercel detecta o Next.js automaticamente (framework preset, build
   `next build`, saída `.next`) — **nenhum `vercel.json` é necessário**.
3. Em **Settings > Environment Variables**, adicione as quatro variáveis de
   `.env.example` com os valores reais do passo 1.

### 3. Local

```bash
cp .env.example .env.local   # preencha com os valores reais
npm install
npm run dev                  # http://localhost:3000
```

## Variáveis de ambiente

| Variável                       | Onde usar | Descrição                              |
| ------------------------------ | --------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | pública   | URL do projeto Supabase                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública   | Chave anon (acesso via RLS)            |
| `SUPABASE_SERVICE_ROLE_KEY`     | servidor  | Chave de serviço — nunca no navegador. Exigida para o Painel Macro persistir observações (o RLS nega escrita a usuários comuns); sem ela, o painel exibe os dados frescos do BCB sem gravar cache |
| `APP_SECRET`                    | servidor  | Segredo HMAC do desafio matemático anti-bot do cadastro (mínimo 16 caracteres; ex.: `openssl rand -hex 32`). **Sem ele, o cadastro trava 100%** — o fail-fast de `lib/env.ts` impede o boot e diz exatamente qual variável falta |

As quatro variáveis são validadas na inicialização do servidor
(`instrumentation.ts` → `lib/env.ts`): se alguma estiver ausente, vazia ou
com `APP_SECRET` curto demais, a aplicação nem inicia. Sem fail-fast, um
esquecimento de env var quebraria o app de forma obscura depois.

`.env.local` está no `.gitignore`. Nenhum segredo real existe neste repositório.

## Escopo da Fase 1 — fundação + núcleo financeiro

Status real (evidências: build passa, RLS 25/25 em 2026-09-16, anti-duplicata
9/9, simulador conferido por duas vias independentes, primeira busca ao vivo
do Painel Macro em 2026-09-16):

- [x] Scaffold Next.js + TS + Tailwind, identidade visual, `lang="pt-BR"`
- [x] Helpers Supabase browser/server sem segredos hardcoded
- [x] Layout base: header com logo, navegação esqueleto, rodapé
- [x] Modelo de dados (migrações: transações, dívidas, metas, perfis, macro) + RLS por `auth.uid() = user_id`
- [x] Auth (Supabase Auth) + desafio matemático anti-bot no cadastro (HMAC via `APP_SECRET`)
- [x] CRUD de transações (lançamento **manual** — ver seção OCR; anexo de foto da nota fiscal como rascunho, com preenchimento manual)
- [x] CRUD de dívidas + simulador avalanche/snowball (regra determinística)
- [x] Relatório Porquê por motor de regras (compute-then-verbalize, sem IA paga)
- [x] Aba Visão (pizza/barras, inflação pessoal, comprometimento de renda, valor livre)
- [x] Painel Macro com dados gratuitos do BCB ao vivo (Selic, IPCA, USD/BRL; cache de 6h, erro honesto)
- [x] Anti-duplicata de transações **atômica via RPC** (`create_transaction_if_unique`: descrição normalizada + categoria iguais, mesmo dia do calendário, criação dentro de 5 minutos)
- [x] Fail-fast de env vars (4 variáveis obrigatórias; `lib/env.ts` + `instrumentation.ts`)
- [x] Security headers (`next.config.ts`: X-Frame-Options DENY, X-Content-Type-Options nosniff, CSP básica funcional)

## Restrição honesta: OCR de notas fiscais

No MVP original, a extração automática de dados da foto da nota fiscal
funcionava porque usava a **capacidade de visão do runtime do artifact** —
um recurso da plataforma onde o MVP roda, não um serviço que possa ser
"copiado" para um app Next.js próprio.

Em produção a custo R$ 0, as opções reais são:

1. **Fluxo manual honesto (Fase 1):** o usuário fotografa a nota como anexo e
   digita os campos. Sem promessa de automação.
2. **Tesseract.js no navegador (Fase 2):** OCR 100% local, grátis, mas com
   precisão limitada em notas térmicas amassadas e custo de UX (processamento
   no aparelho).
3. **OCR no servidor próprio (Fase 2):** possível, mas exige validar
   precisão, privacidade (a imagem trafega para o servidor) e custo de
   processamento no plano free.

**Decisão deliberadamente adiada:** a escolha entre as opções 2 e 3 — com
testes reais de precisão — fica para o **Samuel decidir na Fase 2**. A Fase 1
não declara, promete ou simula OCR automático em nenhum ponto da UI ou da
documentação.

## Ficou para a Fase 2 (não fazer agora)

- Assistente Vital (chat com texto/voz)
- OCR de notas fiscais (decisão do Samuel — ver seção acima)
- Radar de Ativos (ações, FIIs, CDBs)
- Painel Macro expandido / dados de outras fontes
- Open Finance / integrações bancárias (sempre gratuitas ou nada)
- Qualquer IA externa paga, notificações push, app nativo
- Testes E2E e pipeline de CI (desejável antes do primeiro deploy público)
