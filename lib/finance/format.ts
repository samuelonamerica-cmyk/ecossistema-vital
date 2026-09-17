/**
 * Ecossistema Vital — Núcleo Financeiro (Fase 1)
 * lib/finance/format.ts
 *
 * Formatação monetária e de datas — padrão do projeto: USD com locale pt-BR.
 */

export const CURRENCY = "USD" as const;
export const LOCALE = "pt-BR" as const;

const usdFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

/** Formata centavos (number inteiro) como moeda, ex.: 1087 -> "US$ 10,87". */
export function formatCents(cents: number): string {
  return usdFormatter.format(cents / 100);
}

/** Formata um valor em unidades (ex.: 10.87) como moeda. */
export function formatUSD(value: number): string {
  return usdFormatter.format(value);
}

/** "2026-09-16" -> "16/09/2026". */
export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** "2026-09" -> "set/26" (rótulo curto de mês em pt-BR). */
export function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const label = new Intl.DateTimeFormat(LOCALE, { month: "short" })
    .format(new Date(y, m - 1, 1))
    .replace(".", "");
  return `${label}/${String(y).slice(2)}`;
}

/** "2026-09-16" -> "2026-09" (chave ano-mês). */
export function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Categorias fixas do projeto (PT-BR). */
export const CATEGORIAS = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Contas",
  "Investimentos",
  "Renda",
  "Outros",
] as const;

/** Formas de pagamento aceitas (valor interno -> rótulo PT-BR). */
export const METODOS_PAGAMENTO = [
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
  { value: "zelle", label: "Zelle" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
] as const;

export const METODO_PAGAMENTO_VALUES = METODOS_PAGAMENTO.map((m) => m.value);

export function metodoPagamentoLabel(value: string | null): string {
  const found = METODOS_PAGAMENTO.find((m) => m.value === value);
  return found ? found.label : (value ?? "—");
}

/**
 * Núcleo de interpretação de valor digitado (formatos pt-BR ou US).
 * Retorna a string normalizada "1234.56" ou null se o formato for inválido.
 */
function normalizeDecimalString(raw: string): string | null {
  let s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // Formato pt-BR: "1.087,50" — ponto é milhar, vírgula é decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    // Só ponto: decimal quando há 1–2 dígitos após o último ponto
    // ("10.5", "10.50"); milhar quando são 3 ("1.087" -> 1087).
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (
      last.length === 3 &&
      parts.length > 1 &&
      parts.slice(0, -1).every((p) => /^\d{1,3}$/.test(p))
    ) {
      s = parts.join("");
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return s;
}

/**
 * Interpreta um valor monetário digitado (formatos pt-BR ou US):
 * "10,87" -> 10.87 · "10.87" -> 10.87 · "1.087,50" -> 1087.50 · "1087" -> 1087.
 * Retorna null quando inválido ou <= 0.
 */
export function parseAmountInput(raw: string): number | null {
  const s = normalizeDecimalString(raw);
  if (s === null) return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Variante que aceita zero (ex.: saldo ou pagamento mínimo zerado).
 * Retorna null quando inválido ou negativo.
 */
export function parseNonNegativeInput(raw: string): number | null {
  const s = normalizeDecimalString(raw);
  if (s === null) return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}
