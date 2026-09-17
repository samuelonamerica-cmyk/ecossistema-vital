/**
 * Ecossistema Vital — validação fail-fast das variáveis de ambiente.
 *
 * Chamado UMA vez na inicialização do servidor (instrumentation.ts). Se
 * alguma variável obrigatória estiver ausente, a aplicação nem inicia e a
 * mensagem diz EXATAMENTE qual variável falta — nunca quebra de forma
 * obscura depois (ex.: cadastro travando 100% sem APP_SECRET, cliente
 * Supabase com URL undefined).
 *
 * Variáveis obrigatórias:
 *   - NEXT_PUBLIC_SUPABASE_URL       (Supabase: URL do projeto)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY  (Supabase: chave anon pública)
 *   - SUPABASE_SERVICE_ROLE_KEY      (servidor: escrita das tabelas macro)
 *   - APP_SECRET                     (servidor: HMAC do desafio anti-bot;
 *                                     mínimo 16 caracteres)
 */

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_SECRET",
] as const;

const MIN_APP_SECRET_LENGTH = 16;

/** Lista as variáveis obrigatórias ausentes ou vazias. */
export function missingEnvVars(): string[] {
  return REQUIRED_VARS.filter((name) => {
    const value = process.env[name];
    return !value || value.trim() === "";
  });
}

/**
 * Falha na inicialização quando alguma variável obrigatória está ausente
 * (ou APP_SECRET é curta demais). Lança Error com a lista explícita.
 */
export function assertEnv(): void {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    throw new Error(
      "[Ecossistema Vital] Variáveis de ambiente ausentes: " +
        missing.join(", ") +
        ". Defina-as no .env.local (desenvolvimento) ou nas Environment " +
        "Variables do projeto na Vercel (produção). A aplicação não iniciou.",
    );
  }

  const secret = process.env.APP_SECRET as string;
  if (secret.length < MIN_APP_SECRET_LENGTH) {
    throw new Error(
      "[Ecossistema Vital] APP_SECRET precisa ter pelo menos 16 caracteres " +
        "(ex.: openssl rand -hex 32). A aplicação não iniciou.",
    );
  }
}
