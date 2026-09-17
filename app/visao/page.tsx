import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatUSD,
  formatDateBR,
  formatMonthLabel,
  toYearMonth,
} from "@/lib/finance/format";

export const metadata = { title: "Visão — Ecossistema Vital" };

interface TxRow {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  category: string;
  date: string;
}

function monthKeysBack(n: number, base: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export default async function VisaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("transactions")
    .select("id, type, description, amount, category, date")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1000);

  const txs = (data ?? []) as TxRow[];
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthTx = txs.filter((t) => toYearMonth(t.date) === currentKey);
  const totalReceitas = monthTx
    .filter((t) => t.type === "receita")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesas = monthTx
    .filter((t) => t.type === "despesa")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saldo = totalReceitas - totalDespesas;

  const keys = monthKeysBack(6, now);
  const monthly = keys.map((k) => {
    const rec = txs
      .filter((t) => t.type === "receita" && toYearMonth(t.date) === k)
      .reduce((s, t) => s + Number(t.amount), 0);
    const des = txs
      .filter((t) => t.type === "despesa" && toYearMonth(t.date) === k)
      .reduce((s, t) => s + Number(t.amount), 0);
    return { key: k, label: formatMonthLabel(k), receitas: rec, despesas: des };
  });
  const maxBar = Math.max(1, ...monthly.flatMap((m) => [m.receitas, m.despesas]));

  const recent = txs.slice(0, 8);

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-vital-primary-darker">Visão geral</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Resumo calculado a partir dos seus lançamentos reais.
        </p>
      </header>

      {txs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
          <p className="font-medium text-zinc-700">Nenhum dado para mostrar ainda</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registre seus lançamentos para ver o resumo aqui.
          </p>
          <Link
            href="/transacoes"
            className="mt-4 inline-block rounded-lg bg-vital-primary px-4 py-2 text-sm font-semibold text-white hover:bg-vital-primary-dark"
          >
            Ir para Transações
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Receitas do mês</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{formatUSD(totalReceitas)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Despesas do mês</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{formatUSD(totalDespesas)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Saldo do mês</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  saldo >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatUSD(saldo)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-vital-primary-darker">
              Receitas × despesas — últimos 6 meses
            </h2>
            <div
              className="mt-6 flex h-48 items-end gap-3 sm:gap-5"
              role="img"
              aria-label="Gráfico de barras de receitas versus despesas por mês"
            >
              {monthly.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="flex w-full max-w-20 flex-1 items-end justify-center gap-1.5">
                    <div
                      className="flex h-full w-full items-end"
                      title={`Receitas: ${formatUSD(m.receitas)}`}
                    >
                      <div
                        className="w-full rounded-t bg-emerald-600"
                        style={{ height: `${Math.max(2, (m.receitas / maxBar) * 100)}%` }}
                      />
                    </div>
                    <div
                      className="flex h-full w-full items-end"
                      title={`Despesas: ${formatUSD(m.despesas)}`}
                    >
                      <div
                        className="w-full rounded-t bg-red-400"
                        style={{ height: `${Math.max(2, (m.despesas / maxBar) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Receitas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Despesas
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-vital-primary-darker">Últimos lançamentos</h2>
              <Link href="/transacoes" className="text-sm font-medium text-vital-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-zinc-100">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{t.description}</p>
                    <p className="text-xs text-zinc-500">
                      {t.category} · {formatDateBR(t.date)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      t.type === "receita" ? "text-emerald-700" : "text-zinc-900"
                    }`}
                  >
                    {t.type === "receita" ? "+" : "−"}
                    {formatUSD(Number(t.amount))}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
