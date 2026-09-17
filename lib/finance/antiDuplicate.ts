/**
 * Ecossistema Vital — Núcleo Financeiro (Fase 1)
 * lib/finance/antiDuplicate.ts
 *
 * Regra anti-duplicata — implementa EXATAMENTE a lógica que corrigiu o bug
 * real do MVP (receita de $160 registrada duas vezes por double-tap):
 *
 *   Bloqueia quando:
 *     1. descrição normalizada igual (minúsculas, sem acentos, espaços
 *        colapsados) E
 *     2. categoria igual (normalizada) E
 *     3. MESMO DIA no calendário (campo `date`, "YYYY-MM-DD") E
 *     4. `created_at` dentro de 5 minutos.
 *
 * NOTA (2026-09-17): a aplicação em produção NÃO usa mais a checagem
 * check-then-insert deste módulo no fluxo de escrita — a checagem + inserção
 * acontecem atomicamente no banco via RPCs (advisory lock por usuário),
 * definidas em supabase/migrations/20260917000001_atomic_transactions.sql.
 * As funções puras abaixo permanecem como referência executável da regra e
 * para testes unitários (sem dependências externas, testáveis em Node).
 */

export interface TxLike {
  /** Descrição livre do lançamento. */
  description: string;
  /** Categoria do lançamento. */
  category: string;
  /** Dia do calendário no formato "YYYY-MM-DD" (coluna `date`). */
  date: string;
  /** Instante de criação (ISO 8601, coluna `created_at`). */
  created_at: string;
}

/** Janela de duplicidade: 5 minutos em milissegundos. */
export const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Normaliza uma descrição para comparação:
 * minúsculas, trim, espaços colapsados, acentos removidos.
 */
export function normalizeDescription(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Normaliza a categoria para comparação (minúsculas + trim). */
export function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Retorna true quando `novaTx` é considerada duplicata de alguma transação
 * em `recentes` (regra dos 4 critérios acima).
 */
export function isDuplicate(novaTx: TxLike, recentes: TxLike[]): boolean {
  const desc = normalizeDescription(novaTx.description);
  const cat = normalizeCategory(novaTx.category);
  const novaTime = new Date(novaTx.created_at).getTime();

  if (Number.isNaN(novaTime)) return false;

  return recentes.some((r) => {
    if (normalizeDescription(r.description) !== desc) return false;
    if (normalizeCategory(r.category) !== cat) return false;
    // Mesmo dia no calendário (comparação de string "YYYY-MM-DD").
    if (r.date !== novaTx.date) return false;
    const rTime = new Date(r.created_at).getTime();
    if (Number.isNaN(rTime)) return false;
    // created_at dentro de 5 minutos.
    return Math.abs(novaTime - rTime) <= DUPLICATE_WINDOW_MS;
  });
}
