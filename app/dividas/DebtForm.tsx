"use client";

import { useRef, useState } from "react";
import SubmitButton from "../components/SubmitButton";
import { createDebt } from "./actions";

export default function DebtForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await createDebt(formData);
    if (result.ok) {
      formRef.current?.reset();
      setNotice({ kind: "ok", text: "Dívida cadastrada." });
    } else {
      setNotice({ kind: "error", text: result.error ?? "Não foi possível salvar a dívida." });
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onChange={() => setNotice(null)}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-vital-primary-darker">Nova dívida</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Credor</span>
          <input
            name="creditor"
            type="text"
            required
            maxLength={120}
            placeholder="Ex.: Cartão Banco X"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Saldo devedor (US$)</span>
          <input
            name="balance"
            type="text"
            inputMode="decimal"
            required
            placeholder="1.250,00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Juros (% a.a.)</span>
          <input
            name="annual_rate_pct"
            type="text"
            inputMode="decimal"
            required
            placeholder="24"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Pagamento mínimo mensal (US$)</span>
          <input
            name="minimum_payment"
            type="text"
            inputMode="decimal"
            required
            placeholder="50,00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </p>
      )}

      <SubmitButton
        label="Cadastrar dívida"
        pendingLabel="Salvando…"
        className="mt-4 w-full rounded-lg bg-vital-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-vital-primary-dark disabled:opacity-60"
      />
    </form>
  );
}
