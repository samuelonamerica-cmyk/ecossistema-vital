import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatDateBR, metodoPagamentoLabel } from "@/lib/finance/format";
import TransactionForm from "./TransactionForm";
import DeleteTransactionButton from "./DeleteTransactionButton";
import ReceiptUploadForm from "./ReceiptUploadForm";
import DraftCard, { type DraftView } from "./DraftCard";

export const metadata = { title: "Transações — Ecossistema Vital" };

interface TxRow {
  id: string;
  type: "receita" | "despesa";
  description: string;
  amount: number;
  category: string;
  date: string;
  payment_method: string | null;
  created_at: string;
}

export default async function TransacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: transactions }, { data: drafts }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, description, amount, category, date, payment_method, created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("receipt_drafts")
      .select("id, photo_path, created_at")
      .eq("user_id", user.id)
      .eq("status", "manual")
      .order("created_at", { ascending: false }),
  ]);

  const txs = (transactions ?? []) as TxRow[];

  const draftViews: DraftView[] = await Promise.all(
    (drafts ?? []).map(async (d: { id: string; photo_path: string | null; created_at: string }) => {
      let photoUrl: string | null = null;
      if (d.photo_path) {
        const { data } = await supabase.storage
          .from("receipts")
          .createSignedUrl(d.photo_path, 3600);
        photoUrl = data?.signedUrl ?? null;
      }
      return { id: d.id, photoUrl, createdAt: d.created_at };
    }),
  );

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-vital-primary-darker">Transações</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Registre receitas e despesas. Sem dados de demonstração: tudo aqui é real e seu.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <TransactionForm />
        <ReceiptUploadForm />
      </div>

      {draftViews.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-vital-primary-darker">
            Rascunhos de notas ({draftViews.length})
          </h2>
          {draftViews.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-vital-primary-darker">
          Lançamentos {txs.length > 0 && <span className="text-sm font-normal text-zinc-500">({txs.length})</span>}
        </h2>

        {txs.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="font-medium text-zinc-700">Nenhum lançamento ainda</p>
            <p className="mt-1 text-sm text-zinc-500">
              Use o formulário acima para registrar sua primeira receita ou despesa.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`h-9 w-1.5 shrink-0 rounded-full ${
                    t.type === "receita" ? "bg-emerald-600" : "bg-red-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{t.description}</p>
                  <p className="text-xs text-zinc-500">
                    {t.category} · {formatDateBR(t.date)}
                    {t.payment_method ? ` · ${metodoPagamentoLabel(t.payment_method)}` : ""}
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
                <DeleteTransactionButton id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
