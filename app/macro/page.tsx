import { getMacroPanel, type IndicatorPanelData } from "@/lib/macro/refresh";
import RefreshButton from "./RefreshButton";

/** Os dados dependem do estado do cache/BCB: nunca pré-renderizar. */
export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";

function formatValue(ind: IndicatorPanelData): string {
  if (ind.value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: ind.decimals,
    maximumFractionDigits: ind.decimals,
  }).format(ind.value);
}

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

function IndicatorCard({ ind }: { ind: IndicatorPanelData }) {
  const stale = ind.status !== "ok";
  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        stale ? "border-amber-300" : "border-zinc-200"
      }`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {ind.label}
      </h2>
      <p className="mt-2 text-3xl font-bold text-vital-primary-darker">
        {formatValue(ind)}
        <span className="ml-1 text-base font-medium text-zinc-500">{ind.unit}</span>
      </p>
      {ind.referenceLabel && (
        <p className="mt-1 text-sm text-zinc-600">{ind.referenceLabel}</p>
      )}
      <dl className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <div className="flex justify-between gap-2">
          <dt className="font-medium">Fonte</dt>
          <dd className="text-right">Banco Central do Brasil</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-medium">Atualizado em</dt>
          <dd className="text-right">{formatDateTime(ind.fetchedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function MacroPage() {
  let indicators: IndicatorPanelData[];
  let fromCache = false;
  try {
    const panel = await getMacroPanel();
    indicators = panel.indicators;
    fromCache = panel.fromCache;
  } catch {
    // Nunca quebrar a página: degrada para estado vazio honesto.
    indicators = [];
  }

  const hasData = indicators.some((i) => i.value !== null);
  const anyStale = indicators.some((i) => i.status !== "ok");
  const latestFetch = indicators
    .map((i) => i.fetchedAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-vital-primary-darker">
          Painel Macro — Banco Central do Brasil
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Selic, IPCA e dólar (PTAX) direto das APIs oficiais e gratuitas do
          Banco Central. Contexto macro para entender o cenário — sem custo e
          sem número inventado.
        </p>
        <RefreshButton />
        {fromCache && hasData && (
          <p className="text-xs text-zinc-500">
            Exibindo dados em cache (buscados há menos de 6 horas, em{" "}
            {formatDateTime(new Date(latestFetch))}).
          </p>
        )}
      </header>

      {anyStale && hasData && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold">
            ⚠️ Dados temporariamente indisponíveis
          </p>
          <p className="mt-1">
            Não foi possível buscar os dados mais recentes no Banco Central
            agora. Abaixo estão os últimos valores conhecidos, com a data de
            cada um — nenhum número foi estimado.
          </p>
        </div>
      )}

      {!hasData ? (
        <div
          role="alert"
          className="rounded-xl border border-zinc-200 bg-vital-cream p-6 text-sm text-zinc-700"
        >
          <p className="font-semibold text-vital-primary-darker">
            Não foi possível carregar os indicadores no momento.
          </p>
          <p className="mt-1">
            O Banco Central pode estar fora do ar ou ainda não há dados
            salvos. Tente novamente com o botão &ldquo;Atualizar
            indicadores&rdquo; — nenhum valor será exibido até que venha de
            uma fonte oficial.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {indicators.map((ind) => (
            <IndicatorCard key={ind.indicator} ind={ind} />
          ))}
        </div>
      )}

      <footer className="text-xs text-zinc-500">
        <p>
          Fontes: SGS 4189 (Selic efetiva — média mensal), SGS 433 (IPCA mensal) e PTAX venda
          (API Olinda) — Banco Central do Brasil. Atualização automática no
          máximo a cada 6 horas.
        </p>
        <p className="mt-1">Conteúdo educativo. Não constitui recomendação de investimento.</p>
      </footer>
    </section>
  );
}
