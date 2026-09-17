import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role — SOMENTE no servidor, NUNCA exposto ao
 * cliente nem importado em Client Components.
 *
 * Bypassa o RLS por definição do Supabase; usar exclusivamente para dados
 * de referência globais (tabelas macro: macro_indicator_observations e
 * macro_refresh_state), NUNCA para dados de usuários (esses seguem no
 * cliente com sessão do usuário, sob RLS).
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada: escrita das tabelas macro indisponível.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
