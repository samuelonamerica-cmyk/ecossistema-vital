/**
 * lib/macro/bcb.ts — Busca de indicadores macroeconômicos nas APIs
 * OFICIAIS e GRATUITAS do Banco Central do Brasil.
 *
 * Endpoints (confirmados por curl em 16/09/2026):
 *  - SGS (séries temporais): https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1?formato=json
 *      - Selic efetiva, média mensal (% a.a.) ... SGS 4189
 *      - IPCA variação mensal (%) .............. SGS 433
 *
 * NOTA HONESTA (16/09/2026): a meta Selic definida pelo Copom (14,00% a.a.)
 * NÃO é publicada como série temporal gratuita no SGS — as séries 432 e
 * 4189 trazem a taxa EFETIVA (~0,10 p.p. abaixo da meta). Por isso o painel
 * exibe a Selic efetiva (SGS 4189, média mensal) com rótulo correto, em vez
 * de rotular um número errado como "meta".
 *  - PTAX (câmbio, API Olinda):
 *      https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao='MM-DD-AAAA'&$format=json
 *
 * Observação prática: a API SGS bloqueia requisições sem User-Agent
 * (responde vazio/HTTP 200 sem corpo). Por isso todo fetch usa um
 * User-Agent de navegador identificado.
 *
 * Nenhum valor é inventado: em qualquer falha, uma BcbFetchError é
 * lançada e a camada de cache (lib/macro/refresh.ts) decide o que exibir.
 */

export type MacroIndicator = "selic" | "ipca_mensal" | "usd_brl";

/** Dado macro pronto para persistência/exibição. */
export interface MacroObservation {
  /** Indicador (chave do contrato de schema). */
  indicator: MacroIndicator;
  /** Valor numérico: selic = % a.a.; ipca_mensal = % no mês; usd_brl = R$ (PTAX venda). */
  value: number;
  /** Data de referência do dado no BCB (não a hora da busca). */
  observedAt: Date;
  /** Fonte legível para exibição (ex.: "Banco Central do Brasil — SGS 432 (Meta Selic)"). */
  source: string;
  /** Rótulo de referência (ex.: "agosto de 2026", "PTAX venda — fechamento"). */
  referenceLabel: string;
}

/** Erro honesto de busca: nunca carrega um número, só o motivo. */
export class BcbFetchError extends Error {
  public readonly indicator: MacroIndicator;
  public override cause: unknown;

  constructor(indicator: MacroIndicator, message: string, cause?: unknown) {
    super(message);
    this.name = "BcbFetchError";
    this.indicator = indicator;
    this.cause = cause;
  }
}

const SGS_SELIC_EFETIVA_MENSAL = 4189;
const SGS_IPCA_MENSAL = 433;

const USER_AGENT =
  "Mozilla/5.0 (compatible; EcossistemaVital/1.0; indicadores-macro)";
const FETCH_TIMEOUT_MS = 25_000;
const PTAX_LOOKBACK_DAYS = 7;

/** GET JSON com timeout e User-Agent (exigido pelo BCB). */
async function fetchJson(url: string, indicator: MacroIndicator): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new BcbFetchError(
        indicator,
        `BCB respondeu HTTP ${res.status} ao buscar "${indicator}".`,
      );
    }
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof BcbFetchError) throw err;
    const aborted =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    throw new BcbFetchError(
      indicator,
      aborted
        ? `Tempo esgotado ao buscar "${indicator}" no BCB (timeout de ${FETCH_TIMEOUT_MS / 1000}s).`
        : `Falha de rede ao buscar "${indicator}" no BCB.`,
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** "dd/mm/aaaa" (SGS) -> Date. Retorna null se inválida. */
function parseSgsDate(brDate: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface SgsPoint {
  data: string;
  valor: string;
}

function isSgsPointArray(v: unknown): v is SgsPoint[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as SgsPoint).data === "string" &&
        typeof (p as SgsPoint).valor === "string",
    )
  );
}

function parseSgsValue(raw: string, indicator: MacroIndicator): number {
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) {
    throw new BcbFetchError(
      indicator,
      `BCB retornou valor não numérico para "${indicator}": ${JSON.stringify(raw)}.`,
    );
  }
  return value;
}

/**
 * Selic efetiva — média mensal (% a.a.) — SGS 4189.
 * É a taxa efetivamente praticada no mercado (~0,10 p.p. abaixo da meta do
 * Copom). A meta definida pelo Copom não tem série temporal gratuita no SGS.
 */
export async function fetchSelic(): Promise<MacroObservation> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_SELIC_EFETIVA_MENSAL}/dados/ultimos/1?formato=json`;
  const payload = await fetchJson(url, "selic");
  if (!isSgsPointArray(payload)) {
    throw new BcbFetchError("selic", "Resposta inesperada da SGS 4189 (formato).");
  }
  const last = payload[payload.length - 1];
  const observedAt = parseSgsDate(last.data);
  if (!observedAt) {
    throw new BcbFetchError(
      "selic",
      `Data inválida na SGS 4189: ${JSON.stringify(last.data)}.`,
    );
  }
  const value = parseSgsValue(last.valor, "selic");
  return {
    indicator: "selic",
    value,
    observedAt,
    source: "Banco Central do Brasil — SGS 4189 (Selic efetiva, média mensal)",
    referenceLabel: `Selic efetiva de ${formatReferenceMonth(observedAt)}`,
  };
}

const MESES_PT: Record<number, string> = {
  1: "janeiro",
  2: "fevereiro",
  3: "março",
  4: "abril",
  5: "maio",
  6: "junho",
  7: "julho",
  8: "agosto",
  9: "setembro",
  10: "outubro",
  11: "novembro",
  12: "dezembro",
};

/** "agosto de 2026" a partir de uma data (usado no rótulo do IPCA). */
export function formatReferenceMonth(d: Date): string {
  const mes = MESES_PT[d.getUTCMonth() + 1] ?? "";
  return `${mes} de ${d.getUTCFullYear()}`;
}

/** "16/09/2026" (horário local de quem formata). */
export function formatDayMonthYear(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** IPCA — variação % mensal — SGS 433. */
export async function fetchIpca(): Promise<MacroObservation> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_IPCA_MENSAL}/dados/ultimos/1?formato=json`;
  const payload = await fetchJson(url, "ipca_mensal");
  if (!isSgsPointArray(payload)) {
    throw new BcbFetchError("ipca_mensal", "Resposta inesperada da SGS 433 (formato).");
  }
  const last = payload[payload.length - 1];
  const observedAt = parseSgsDate(last.data);
  if (!observedAt) {
    throw new BcbFetchError(
      "ipca_mensal",
      `Data inválida na SGS 433: ${JSON.stringify(last.data)}.`,
    );
  }
  const value = parseSgsValue(last.valor, "ipca_mensal");
  return {
    indicator: "ipca_mensal",
    value,
    observedAt,
    source: "Banco Central do Brasil — SGS 433 (IPCA mensal)",
    referenceLabel: `IPCA de ${formatReferenceMonth(observedAt)}`,
  };
}

interface PtaxBulletin {
  paridadeCompra: number;
  paridadeVenda: number;
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string; // "aaaa-mm-dd HH:MM:SS.mmmmmm" (horário de Brasília)
  tipoBoletim: string; // "Abertura" | "Intermediário" | "Fechamento PTAX"
}

interface PtaxDayResponse {
  value: PtaxBulletin[];
}

function isPtaxDayResponse(v: unknown): v is PtaxDayResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as PtaxDayResponse).value) &&
    (v as PtaxDayResponse).value.every(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        typeof (b as PtaxBulletin).cotacaoVenda === "number" &&
        typeof (b as PtaxBulletin).dataHoraCotacao === "string" &&
        typeof (b as PtaxBulletin).tipoBoletim === "string",
    )
  );
}

/** "aaaa-mm-dd HH:MM:SS[.frac]" (Brasília) -> Date. */
function parsePtaxDateTime(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  // Horário de Brasília = UTC-3 (sem horário de verão desde 2019).
  const dt = new Date(
    `${y}-${mo}-${d}T${h}:${mi}:${se}-03:00`,
  );
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * USD/BRL — PTAX venda (API Olinda).
 * A PTAX só é publicada em dias úteis: tenta a data de referência e volta
 * até PTAX_LOOKBACK_DAYS dias até achar um dia com cotação. Usa o boletim
 * "Fechamento PTAX" quando disponível, senão o último boletim do dia.
 */
export async function fetchUsdBrl(referenceDate: Date = new Date()): Promise<MacroObservation> {
  let lastError: unknown = null;

  for (let back = 0; back < PTAX_LOOKBACK_DAYS; back++) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - back);
    const dataCotacao = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${d.getFullYear()}`;
    const url =
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
      `CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao='${dataCotacao}'&$format=json`;

    let payload: unknown;
    try {
      payload = await fetchJson(url, "usd_brl");
    } catch (err) {
      lastError = err;
      continue; // tenta o dia anterior
    }
    if (!isPtaxDayResponse(payload) || payload.value.length === 0) {
      continue; // sem cotação neste dia (fim de semana/feriado): tenta o anterior
    }

    const bulletins = payload.value;
    const closing =
      bulletins.find((b) => b.tipoBoletim === "Fechamento PTAX") ??
      bulletins[bulletins.length - 1];
    if (!Number.isFinite(closing.cotacaoVenda)) {
      continue;
    }
    const observedAt = parsePtaxDateTime(closing.dataHoraCotacao);
    if (!observedAt) {
      throw new BcbFetchError(
        "usd_brl",
        `Data/hora inválida na PTAX: ${JSON.stringify(closing.dataHoraCotacao)}.`,
      );
    }
    return {
      indicator: "usd_brl",
      value: closing.cotacaoVenda,
      observedAt,
      source: "Banco Central do Brasil — PTAX (API Olinda)",
      referenceLabel: `PTAX venda — ${closing.tipoBoletim} de ${formatDayMonthYear(observedAt)}`,
    };
  }

  throw new BcbFetchError(
    "usd_brl",
    `Nenhuma cotação PTAX encontrada nos últimos ${PTAX_LOOKBACK_DAYS} dias.`,
    lastError,
  );
}

/** Busca os 3 indicadores de uma vez; cada um falha de forma independente. */
export async function fetchAllMacro(): Promise<{
  selic: MacroObservation;
  ipca_mensal: MacroObservation;
  usd_brl: MacroObservation;
}> {
  const [selic, ipca_mensal, usd_brl] = await Promise.all([
    fetchSelic(),
    fetchIpca(),
    fetchUsdBrl(),
  ]);
  return { selic, ipca_mensal, usd_brl };
}
