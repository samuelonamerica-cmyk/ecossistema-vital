/**
 * Ecossistema Vital — hook de inicialização do servidor (Next.js).
 *
 * Executa UMA vez quando o servidor Node.js inicia (`next start` / `next dev`).
 * Valida as variáveis de ambiente obrigatórias no boot (fail-fast): sem elas,
 * a aplicação nem inicia, em vez de quebrar de forma obscura depois
 * (ex.: cadastro travando sem APP_SECRET).
 *
 * Durante o build (`next build`, NEXT_PHASE=phase-production-build) a
 * validação é pulada: a coleta de páginas não é inicialização do servidor.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("./lib/env");
    assertEnv();
  }
}
