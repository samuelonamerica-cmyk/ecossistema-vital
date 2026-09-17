"use client";

import { useState } from "react";
import SubmitButton from "../components/SubmitButton";
import { deleteDebt, updateDebt } from "./actions";
import { formatUSD } from "@/lib/finance/format";

export interface DebtView {
  id: string;
  creditor: string;
  balance: number;
  annual_rate_pct: number;
  minimum_payment: number;
}

export default function DebtRow({ debt }: { debt: DebtView }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await updateDebt(debt.id, formData);
    if (result.ok) {
      setError(null);
      setEditing(false);
    } else {
      setError(result.error ?? "Não foi possível atualizar a dívida.");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir a dívida "${debt.creditor}"?`)) return;
    setDeleting(true);
    const result = await deleteDebt(debt.id);
    setDeleting(false);
    if (!result.ok) window.alert(result.error ?? "Não foi possível excluir.");
  }

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Credor</span>
            <input
              name="creditor"
              type="text"
              required
              defaultValue={debt.creditor}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Saldo (US$)</span>
            <input
              name="balance"
              type="text"
              inputMode="decimal"
              required
              defaultValue={debt.balance.toFixed(2).replace(".", ",")}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Juros (% a.a.)</span>
            <input
              name="annual_rate_pct"
              type="text"
              inputMode="decimal"
              required
              defaultValue={String(debt.annual_rate_pct)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Pagamento mínimo (US$)</span>
            <input
              name="minimum_payment"
              type="text"
              inputMode="decimal"
              required
              defaultValue={debt.minimum_payment.toFixed(2).replace(".", ",")}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <SubmitButton
              label="Salvar"
              pendingLabel="Salvando…"
              className="rounded-lg bg-vital-primary px-4 py-2 text-sm font-semibold text-white hover:bg-vital-primary-dark disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{debt.creditor}</p>
        <p className="text-xs text-zinc-500">
          {debt.annual_rate_pct}% a.a. · mínimo {formatUSD(debt.minimum_payment)}/mês
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-zinc-900">{formatUSD(debt.balance)}</p>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? "Excluindo…" : "Excluir"}
        </button>
      </div>
    </li>
  );
}
