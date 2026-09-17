"use client";

import { useState } from "react";
import {
  runSimulation,
  type SimulationViewResult,
  type SimulationRowView,
} from "./actions";
import { formatCents } from "@/lib/finance/format";

const STRATEGY_LABELS: Record<SimulationRowView["strategy"], string> = {
  avalanche: "Avalanche (maior juro primeiro)",
  snowball: "Snowball (menor saldo primeiro)",
  minimos: "Só mínimos (cenário-base)",
};

function monthsLabel(months: number | null): string {
  if (months === null) return "—";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const y = `${years} ${years === 1 ? "ano" : "anos"}`;
  return rest === 0 ? y : `${y} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}

export default function DebtSimulator({ hasDebts }: { hasDebts: boolean }) {
  const [extra, setExtra] = useState("100");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SimulationViewResult | null>(null);

  async function handleSimulate() {
    setPending(true);
    const r = await runSimulation(extra);
    setPending(false);
    setResult(r);
  }

  const view = result && result.ok ? result : null;

  const rows: SimulationRowView[] | null =
    view && view.avalanche && view.snowball && view.minimos
      ? [view.avalanche, view.snowball, view.minimos]
      : null;

  const bestOrder =
    view && view.bestByInterest === "avalanche"
      ? view.avalanche?.payoffOrder
      : view?.snowball?.payoffOrder;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-vital-primary-darker">
        Simulador: avalanche × snowball
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        A simulação paga os mínimos de todas as dívidas todo mês e aplica o valor extra na
        dívida-alvo. Juros compostos mensais (taxa anual ÷ 12), cálculo em centavos exatos.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block sm:max-w-xs sm:flex-1">
          <span className="text-sm font-medium text-zinc-700">
            Quanto você pode pagar por mês <em>além</em> dos mínimos? (US$)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="100"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={pending || !hasDebts}
          className="rounded-lg bg-vital-gold px-5 py-2 text-sm font-semibold text-zinc-900 hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Simulando…" : "Simular"}
        </button>
      </div>

      {!hasDebts && (
        <p className="mt-3 text-sm text-zinc-500">
          Cadastre ao menos uma dívida acima para usar o simulador.
        </p>
      )}

      {result && !result.ok && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {result.error}
        </p>
      )}

      {rows && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-medium">Estratégia</th>
                <th className="py-2 pr-3 font-medium">Tempo até quitar</th>
                <th className="py-2 pr-3 font-medium">Juros totais</th>
                <th className="py-2 font-medium">Total pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const isBest = view?.bestByInterest === r.strategy;
                return (
                  <tr key={r.strategy} className={isBest ? "bg-emerald-50/60" : undefined}>
                    <td className="py-2.5 pr-3 font-medium text-zinc-800">
                      {STRATEGY_LABELS[r.strategy]}
                      {isBest && (
                        <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          menor juro
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-700">
                      {r.paidOff ? (
                        monthsLabel(r.months)
                      ) : (
                        <span className="text-red-700">
                          Não quita — mínimos não cobrem os juros
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-700">{formatCents(r.totalInterestCents)}</td>
                    <td className="py-2.5 text-zinc-700">{formatCents(r.totalPaidCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {typeof view?.interestSavedVsMinimosCents === "number" &&
            view.interestSavedVsMinimosCents > 0 && (
              <div className="mt-4 rounded-lg border border-vital-gold bg-vital-cream p-4">
                <p className="text-sm font-semibold text-vital-primary-darker">
                  Economia da melhor estratégia vs. pagar só os mínimos
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  <strong className="text-emerald-700">
                    {formatCents(view.interestSavedVsMinimosCents)}
                  </strong>{" "}
                  em juros
                  {typeof view.monthsSavedVsMinimos === "number" &&
                    view.monthsSavedVsMinimos > 0 && (
                      <>
                        {" "}e <strong>{monthsLabel(view.monthsSavedVsMinimos)}</strong> de
                        antecipação
                      </>
                    )}
                  .
                </p>
              </div>
            )}

          {bestOrder && bestOrder.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-700">
                Ordem de quitação ({view?.bestByInterest === "avalanche" ? "avalanche" : "snowball"}):
              </p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
                {bestOrder.map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ol>
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-400">
            Simulação educativa. Não constitui recomendação de investimento.
          </p>
        </div>
      )}
    </div>
  );
}
