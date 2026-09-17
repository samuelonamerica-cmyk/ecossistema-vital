/**
 * lib/macro/cache.ts — Regra de cache do Painel Macro (lógica pura, sem I/O).
 *
 * O cache é válido quando TODOS os indicadores satisfazem:
 *   last_fetch_at < 6h atrás  &&  last_status = 'ok'
 * Qualquer outro caso (falha anterior, primeira busca, cache expirado)
 * permite uma nova tentativa de busca no BCB.
 */

/** Tempo de vida do cache: 6 horas. */
export const MACRO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function isCacheFresh(
  lastFetchAt: Date | null,
  lastStatus: string | null,
  now: Date = new Date(),
  ttlMs: number = MACRO_CACHE_TTL_MS,
): boolean {
  if (!lastFetchAt || Number.isNaN(lastFetchAt.getTime())) return false;
  if (lastStatus !== "ok") return false;
  return now.getTime() - lastFetchAt.getTime() < ttlMs;
}
