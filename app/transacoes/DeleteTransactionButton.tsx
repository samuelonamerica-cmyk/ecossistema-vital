"use client";

import { useState } from "react";
import { deleteTransaction } from "./actions";

export default function DeleteTransactionButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Excluir este lançamento? Essa ação não pode ser desfeita.")) return;
    setPending(true);
    setError(null);
    const result = await deleteTransaction(id);
    setPending(false);
    if (!result.ok) setError(result.error ?? "Não foi possível excluir.");
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Excluindo…" : "Excluir"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
