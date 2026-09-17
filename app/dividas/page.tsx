import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DebtForm from "./DebtForm";
import DebtRow, { type DebtView } from "./DebtRow";
import DebtSimulator from "./DebtSimulator";

export const metadata = { title: "Dívidas — Ecossistema Vital" };

export default async function DividasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("debts")
    .select("id, creditor, balance, annual_rate_pct, minimum_payment")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const debts: DebtView[] = (data ?? []).map((d) => ({
    id: d.id as string,
    creditor: d.creditor as string,
    balance: Number(d.balance),
    annual_rate_pct: Number(d.annual_rate_pct),
    minimum_payment: Number(d.minimum_payment),
  }));

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-vital-primary-darker">Dívidas</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cadastre suas dívidas e simule as estratégias avalanche e snowball para decidir por
          onde começar.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DebtForm />
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-lg font-semibold text-vital-primary-darker">
            Suas dívidas{" "}
            {debts.length > 0 && (
              <span className="text-sm font-normal text-zinc-500">({debts.length})</span>
            )}
          </h2>
          {debts.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <p className="font-medium text-zinc-700">Nenhuma dívida cadastrada</p>
              <p className="mt-1 text-sm text-zinc-500">
                Use o formulário ao lado para cadastrar a primeira.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
              {debts.map((d) => (
                <DebtRow key={d.id} debt={d} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <DebtSimulator hasDebts={debts.length > 0} />
    </section>
  );
}
