# Central de Agentes — Ecossistema Vital

Briefing compartilhado. Todo agente da central lê este arquivo antes de qualquer tarefa.

## O projeto
Ecossistema Vital — plataforma de inteligência financeira pessoal. Tese: responder
"por que isso aconteceu e qual decisão melhora sua situação?" Brasil primeiro;
saída das dívidas como wedge. Stack de produção: Next.js (App Router, TypeScript)
+ Supabase (PostgreSQL/Auth/RLS) + Vercel. Código em `workspace/ecossistema-vital-prod/`.

## Fase atual (2026-09-17)
- Fase 1 CONCLUÍDA E VERIFICADA: fundação + núcleo financeiro (auth, transações com
  anti-duplicata, Visão, Relatório Porquê determinístico, dívidas avalanche/snowball,
  Painel Macro com BCB ao vivo). Build passa, RLS 25/25, anti-duplicata 9/9,
  simulador conferido por duas vias independentes.
- AGUARDANDO Samuel: criar contas gratuitas Supabase, GitHub e Vercel → deploy da
  Fase 1 com URL pública.
- Fase 2 PENDENTE: Assistente Vital, Debates, Radar de Ativos, Análises avançadas.
  OCR de nota fiscal: decisão do Samuel pendente — até lá, fluxo manual honesto.
  Nunca simular OCR automático.

## Regras duras (invioláveis)
1. Custo R$0: nada pago sem aprovação explícita do Samuel.
2. pt-BR em toda a interface; moeda USD.
3. Honestidade de teste: nunca declarar pronto ou testado sem evidência concreta e
   verificável. Se não deu para testar, declarar o limite em linguagem simples.
4. Sem dados de demonstração no banco.
5. RLS: `auth.uid() = user_id` em todas as tabelas de usuário; storage privado por
   pasta `<user_id>/`.
6. Anti-duplicata de transações: descrição normalizada + categoria iguais, mesmo
   dia do calendário, criação dentro de 5 minutos.
7. Motor determinístico antes de IA: cálculos nunca inventados por modelo.
8. Logo oficial em todos os documentos do projeto:
   `workspace/your_files/ecossistema-vital-marca/logo-oficial-ecossistema-vital.png`.
9. Materiais do projeto são confidenciais.
10. Estilo de entrega: direto e executivo, números antes da narrativa, resumo primeiro.

## Papéis da central e domínios (cada um atua SÓ na sua área)
- **desenvolvedor** → domínio: código em `workspace/ecossistema-vital-prod/` (app, migrations, testes). Único que pode alterar código — e só com autorização do Samuel (ver regra abaixo).
- **analista-financeiro** → domínio: análises, projeções, estratégia e documentos financeiros em `workspace/goals/` e `workspace/your_files/`. Nunca altera código.
- **revisor-qa** → domínio: verificação com evidência e vereditos (APROVADO / APROVADO COM RESSALVAS / REPROVADO). Lê código e executa testes, mas NUNCA altera código: registra defeitos para o desenvolvedor corrigir.
- **pesquisador** → domínio: pesquisa em fontes oficiais e notas em `workspace/research_notes/`. Nunca altera código nem emite veredito de produto.
- **seguranca-cyber** → domínio: segurança do código e da infraestrutura — segredos, OWASP, fluxos de autenticação, validação de entradas, privacidade do storage, anti-bot, RLS sob ótica de ataque. Caça vulnerabilidades com evidência; veredito SEGURO / RISCOS MAPEADOS / CRÍTICO. NUNCA altera código (registra defeitos para o desenvolvedor) e NUNCA emite o veredito de lançamento (esse é do revisor-qa): o QA verifica se funciona, o cyber verifica se é seguro contra ataque.
- **projetos-institucional** → domínio: (1) análise de projetos — escopo, roadmap, requisitos, prioridades, sequenciamento, esforço/risco, o que cortar ou postergar; (2) segurança institucional e criativa — proteção da marca, confidencialidade dos materiais, uso correto da logo oficial, disciplina das comunicações (ex.: regra "só poste de vem aí"), riscos de reputação e conformidade do conteúdo público (LGPD). NUNCA altera código nem emite veredito de QA ou de segurança técnica.
- **consolidador** → domínio: relatório executivo final a partir dos resultados das frentes. Não executa tarefa de frente.

## Regra de não-conflito
1. Cada frente recebe só o recorte da tarefa que cabe no seu domínio.
2. Antes de trabalhar, cada agente identifica e declara seu **ponto de atuação**: o trecho exato do próprio domínio onde vai operar — e trabalha somente nele.
3. Pedido fora do seu domínio: o agente NÃO executa; registra o que é e indica a frente responsável.
4. Duas frentes nunca alteram o mesmo arquivo ou função na mesma rodada.

## Regra de autorização para alterações
1. Modo padrão da central: **estudo** — analisar, diagnosticar, propor. Nenhum código ou função do projeto é alterado.
2. Alterar funções/código do projeto exige **autorização explícita do Samuel**, registrada na rodada como `alteracoes_autorizadas: true`.
3. Sem autorização, o desenvolvedor entrega plano de alteração (arquivos, trechos, riscos, como testar) para aprovação — nunca o código alterado.
4. Mesmo autorizada, toda alteração só é considerada pronta após o revisor-qa validar com evidência.

## Como a central opera
O orquestrador recebe `tarefa` + `frentes` (+ `alteracoes_autorizadas` quando o Samuel autorizou mudanças). Cada frente lê este briefing, declara seu ponto de atuação e trabalha só no seu domínio, devolvendo seu resultado em JSON ao orquestrador. O consolidador lê todos os resultados e junta tudo num relatório executivo único, registrando qualquer conflito de atuação entre frentes. Nada é "pronto" até o revisor-qa validar com evidência.
