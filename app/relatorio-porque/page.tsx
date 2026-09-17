import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildWhyReport,
  type WhyTransaction,
  type WhyDebt,
} from "@/lib/why/engine";
import { formatUSD } from "@/lib/finance/format";

export const metadata = { title: "Relatório Porquê — Ecossistema Vital" };

const SECTION_ACCENTS = [
  "border-vital-primary",
  "border-vital-gold",
  "border-emerald-400",
] as const;

export default async function RelatorioPorquePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: txData }, { data: debtData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, description, amount, category, date")
      .eq("user_id", user.id)
      .order("date", { ascending: true })
      .limit(2000),
    supabase
      .from("debts")
      .select("creditor, balance, annual_rate_pct, minimum_payment")
      .eq("user_id", user.id),
  ]);

  const transactions: WhyTransaction[] = (txData ?? []).map((t) => ({
    type: t.type as "receita" | "despesa",
    description: t.description as string,
    amount: Number(t.amount),
    category: t.category as string,
    date: t.date as string,
  }));

  const debts: WhyDebt[] = (debtData ?? []).map((d) => ({
    creditor: d.creditor as string,
    balance: Number(d.balance),
    annualRatePct: Number(d.annual_rate_pct),
    minimumPayment: Number(d.minimum_payment),
  }));

  const report = buildWhyReport(transactions, debts);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-vital-primary-darker">Relatório Porquê</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Não só quanto você gastou — mas por que isso aconteceu, e qual decisão melhora sua
          situação. Calculado agora, a partir dos seus dados reais, por um motor determinístico
          (sem IA).
        </p>
      </header>

      {!report.hasData ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
          <p className="font-medium text-zinc-700">Nenhum dado para analisar ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            {report.sections[0]?.paragraphs[0]}
          </p>
          <Link
            href="/transacoes"
            className="mt-4 inline-block rounded-lg bg-vital-primary px-4 py-2 text-sm font-semibold text-white hover:bg-vital-primary-dark"
          >
            Registrar lançamentos
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Receitas</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {formatUSD(report.facts.totalReceitas)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Despesas</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">
                {formatUSD(report.facts.totalDespesas)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-zinc-500">Saldo</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  report.facts.saldo >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatUSD(report.facts.saldo)}
              </p>
            </div>
          </div>

          {report.sections.map((section, i) => (
            <article
              key={section.title}
              className={`rounded-xl border border-zinc-200 border-l-4 ${SECTION_ACCENTS[i % SECTION_ACCENTS.length]} bg-white p-5 shadow-sm`}
            >
              <h2 className="text-lg font-semibold text-vital-primary-darker">{section.title}</h2>
              <div className="mt-2 flex flex-col gap-2">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-zinc-700">
                    {p}
                  </p>
                ))}
              </div>
            </article>
          ))}

          <p className="text-xs text-zinc-400">
            Gerado em {new Date(report.generatedAtISO).toLocaleString("pt-BR")} ·{" "}
            {report.facts.mesesAnalisados}{" "}
            {report.facts.mesesAnalisados === 1 ? "mês analisado" : "meses analisados"} · Conteúdo
            educativo, não constitui recomendação de investimento.
          </p>
        </>
      )}
    </section>
  );
}
