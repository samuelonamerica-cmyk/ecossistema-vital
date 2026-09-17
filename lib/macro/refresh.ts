/**
 * lib/macro/refresh.ts — Orquestração do Painel Macro: cache de 6h,
 * persistência das observações e tratamento honesto de falhas.
 *
 * Contrato de schema (tabelas criadas por outro agente — NÃO mexer em
 * supabase/migrations/ aqui):
 *  - macro_indicator_observations(id, indicator, value, observed_at, source, fetched_at)
 *  - macro_refresh_state(indicator PK, last_fetch_at, last_status)
 *
 * Regras:
 *  1. Antes de buscar no BCB, lê macro_refresh_state. Se TODOS os
 *     indicadores têm last_fetch_at < 6h e last_status = 'ok', reutiliza
 *     as últimas observações SEM chamar o BCB (fromCache = true).
 *  2. Após busca bem-sucedida (por indicador): insere uma linha em
 *     macro_indicator_observations (source = 'BCB', observed_at = data de
 *     referência do BCB) e atualiza macro_refresh_state para 'ok'.
 *  3. Em FALHA (por indicador): atualiza last_status = 'error' e NÃO
 *     insere nenhum número inventado. A UI exibe os últimos valores
 *     conhecidos com o horário + aviso honesto.
 *  4. Sem credenciais do Supabase (ou qualquer erro de leitura), o painel
 *     degrada para um estado vazio honesto — nunca quebra a página.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  BcbFetchError,
  fetchIpca,
  fetchSelic,
  fetchUsdBrl,
  formatDayMonthYear,
  formatReferenceMonth,
  type MacroIndicator,
  type MacroObservation,
} from "./bcb";
import { isCacheFresh, MACRO_CACHE_TTL_MS } from "./cache";

export type IndicatorStatus = "ok" | "error" | "never";

export interface IndicatorPanelData {
  indicator: MacroIndicator;
  label: string;
  /** Unidade exibida junto ao valor (ex.: "% a.a."). */
  unit: string;
  /** Casas decimais na exibição. */
  decimals: number;
  value: number | null;
  /** Data de referência do dado no BCB. */
  observedAt: Date | null;
  /** Quando buscamos/armazenamos. */
  fetchedAt: Date | null;
  source: string | null;
  referenceLabel: string | null;
  status: IndicatorStatus;
}

export interface MacroPanelResult {
  indicators: IndicatorPanelData[];
  /** true quando NENHUMA chamada ao BCB foi feita (cache de 6h respeitado). */
  fromCache: boolean;
}

const INDICATOR_META: Array<{
  indicator: MacroIndicator;
  label: string;
  unit: string;
  decimals: number;
  fetch: () => Promise<MacroObservation>;
}> = [
  { indicator: "selic", label: "Selic efetiva", unit: "% a.a.", decimals: 2, fetch: fetchSelic },
  {
    indicator: "ipca_mensal",
    label: "IPCA",
    unit: "% no mês",
    decimals: 2,
    fetch: fetchIpca,
  },
  {
    indicator: "usd_brl",
    label: "Dólar (PTAX)",
    unit: "R$ venda",
    decimals: 4,
    fetch: () => fetchUsdBrl(),
  },
];

const SOURCE_TAG = "BCB";

interface RefreshStateRow {
  indicator: string;
  last_fetch_at: string | null;
  last_status: string | null;
}

interface ObservationRow {
  indicator: string;
  value: number | string;
  observed_at: string | null;
  source: string | null;
  fetched_at: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lê estado + última observação de cada indicador. Falha silenciosa -> vazio. */
async function readPanelState(supabase: SupabaseClient): Promise<{
  states: Map<MacroIndicator, { lastFetchAt: Date | null; lastStatus: string | null }>;
  observations: Map<MacroIndicator, ObservationRow>;
}> {
  const states = new Map<MacroIndicator, { lastFetchAt: Date | null; lastStatus: string | null }>();
  const observations = new Map<MacroIndicator, ObservationRow>();

  const { data: stateRows, error: stateError } = await supabase
    .from("macro_refresh_state")
    .select("indicator, last_fetch_at, last_status");
  if (stateError) throw stateError;
  for (const row of (stateRows ?? []) as RefreshStateRow[]) {
    const ind = row.indicator as MacroIndicator;
    states.set(ind, {
      lastFetchAt: toDate(row.last_fetch_at),
      lastStatus: row.last_status,
    });
  }

  for (const { indicator } of INDICATOR_META) {
    const { data, error } = await supabase
      .from("macro_indicator_observations")
      .select("indicator, value, observed_at, source, fetched_at")
      .eq("indicator", indicator)
      .order("fetched_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data?.[0] ?? null) as ObservationRow | null;
    if (row) observations.set(indicator, row);
  }

  return { states, observations };
}

function buildPanelData(
  observations: Map<MacroIndicator, ObservationRow>,
  states: Map<MacroIndicator, { lastFetchAt: Date | null; lastStatus: string | null }>,
): IndicatorPanelData[] {
  return INDICATOR_META.map(({ indicator, label, unit, decimals }) => {
    const obs = observations.get(indicator);
    const st = states.get(indicator);
    const value =
      obs && Number.isFinite(Number(obs.value)) ? Number(obs.value) : null;
    const status: IndicatorStatus =
      value === null ? "never" : st?.lastStatus === "error" ? "error" : "ok";
    const observedAt = toDate(obs?.observed_at ?? null);
    return {
      indicator,
      label,
      unit,
      decimals,
      value,
      observedAt,
      fetchedAt: toDate(obs?.fetched_at ?? null),
      source: obs?.source ?? null,
      referenceLabel: referenceLabelFor(indicator, observedAt),
      status,
    };
  });
}

/** Rótulo de referência reconstruído a partir da data do dado no BCB. */
function referenceLabelFor(
  indicator: MacroIndicator,
  observedAt: Date | null,
): string | null {
  if (!observedAt) return null;
  switch (indicator) {
    case "selic":
      return `Selic efetiva — média de ${formatReferenceMonth(observedAt)}`;
    case "ipca_mensal":
      return `IPCA de ${formatReferenceMonth(observedAt)}`;
    case "usd_brl":
      return `PTAX venda de ${formatDayMonthYear(observedAt)}`;
  }
}

/**
 * Retorna os dados do painel.
 * @param force true = ignora o cache (botão "Atualizar indicadores").
 */
export async function getMacroPanel(options: { force?: boolean } = {}): Promise<MacroPanelResult> {
  const { force = false } = options;
  const now = new Date();

  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch {
    // Sem credenciais/configuração: painel vazio honesto.
    return {
      indicators: buildPanelData(new Map(), new Map()),
      fromCache: false,
    };
  }

  let states: Map<MacroIndicator, { lastFetchAt: Date | null; lastStatus: string | null }>;
  let observations: Map<MacroIndicator, ObservationRow>;
  try {
    ({ states, observations } = await readPanelState(supabase));
  } catch {
    return {
      indicators: buildPanelData(new Map(), new Map()),
      fromCache: false,
    };
  }

  // Cache de 6h: todos os indicadores frescos e ok -> sem chamar o BCB.
  const cacheValid =
    !force &&
    INDICATOR_META.every(({ indicator }) => {
      const st = states.get(indicator);
      return (
        isCacheFresh(st?.lastFetchAt ?? null, st?.lastStatus ?? null, now, MACRO_CACHE_TTL_MS) &&
        observations.has(indicator)
      );
    });
  if (cacheValid) {
    return { indicators: buildPanelData(observations, states), fromCache: true };
  }

  // Busca cada indicador de forma independente (um pode falhar sem
  // impedir os outros).
  const results = await Promise.allSettled(
    INDICATOR_META.map(({ fetch }) => fetch()),
  );

  // Escrita nas tabelas macro: o RLS nega escrita a authenticated (só
  // leitura), então a persistência usa service_role no servidor. Sem a
  // chave, os dados frescos ainda são exibidos — só não são persistidos.
  let writer: ReturnType<typeof createServiceRoleClient> | null = null;
  try {
    writer = createServiceRoleClient();
  } catch {
    writer = null;
  }

  for (let i = 0; i < INDICATOR_META.length; i++) {
    const { indicator } = INDICATOR_META[i];
    const result = results[i];
    const fetchedAt = new Date().toISOString();

    if (result.status === "fulfilled") {
      const obs: MacroObservation = result.value;
      observations.set(indicator, {
        indicator: obs.indicator,
        value: obs.value,
        observed_at: obs.observedAt.toISOString(),
        source: obs.source,
        fetched_at: fetchedAt,
      });
      let persistStatus = "ok";
      if (writer) {
        try {
          const { error: insertError } = await writer
            .from("macro_indicator_observations")
            .insert({
              indicator: obs.indicator,
              value: obs.value,
              observed_at: obs.observedAt.toISOString(),
              source: SOURCE_TAG,
              fetched_at: fetchedAt,
            });
          if (insertError) throw insertError;
          const { error: upsertError } = await writer
            .from("macro_refresh_state")
            .upsert(
              {
                indicator: obs.indicator,
                last_fetch_at: fetchedAt,
                last_status: "ok",
              },
              { onConflict: "indicator" },
            );
          if (upsertError) throw upsertError;
        } catch {
          // Falha de escrita: não finge frescor no cache.
          persistStatus = "error";
        }
      }
      states.set(indicator, {
        lastFetchAt: new Date(fetchedAt),
        lastStatus: persistStatus,
      });
    } else {
      // Falha de busca: registra 'error' e NÃO insere número algum.
      const reason =
        result.reason instanceof BcbFetchError
          ? result.reason.message
          : String(result.reason);
      console.error(`[macro] falha ao buscar "${indicator}": ${reason}`);
      states.set(indicator, {
        lastFetchAt: new Date(fetchedAt),
        lastStatus: "error",
      });
      if (writer) {
        await writer
          .from("macro_refresh_state")
          .upsert(
            { indicator, last_fetch_at: fetchedAt, last_status: "error" },
            { onConflict: "indicator" },
          )
          .then(() => undefined, () => undefined);
      }
    }
  }

  return { indicators: buildPanelData(observations, states), fromCache: false };
}
