"use client";

import { useRef, useState } from "react";
import SubmitButton from "../components/SubmitButton";
import { createTransaction } from "./actions";
import { CATEGORIAS, METODOS_PAGAMENTO } from "@/lib/finance/format";

function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function TransactionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await createTransaction(formData);
    if (result.ok) {
      formRef.current?.reset();
      setNotice({ kind: "ok", text: "Lançamento salvo com sucesso." });
    } else {
      setNotice({ kind: "error", text: result.error ?? "Não foi possível salvar o lançamento." });
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onChange={() => setNotice(null)}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-vital-primary-darker">Novo lançamento</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-zinc-700">Tipo</legend>
          <div className="mt-1 flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm has-checked:border-vital-primary has-checked:bg-emerald-50 has-checked:font-semibold">
              <input type="radio" name="type" value="receita" defaultChecked className="accent-emerald-700" />
              Receita
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm has-checked:border-red-700 has-checked:bg-red-50 has-checked:font-semibold">
              <input type="radio" name="type" value="despesa" className="accent-red-700" />
              Despesa
            </label>
          </div>
        </fieldset>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Descrição</span>
          <input
            name="description"
            type="text"
            required
            maxLength={120}
            placeholder="Ex.: Supermercado, salário, aluguel"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Valor (US$)</span>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="10,87"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Data</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={localToday()}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Categoria</span>
          <select
            name="category"
            required
            defaultValue="Alimentação"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Forma de pagamento</span>
          <select
            name="payment_method"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
          >
            <option value="">Não informar</option>
            {METODOS_PAGAMENTO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </p>
      )}

      <SubmitButton
        label="Salvar lançamento"
        pendingLabel="Salvando…"
        className="mt-4 w-full rounded-lg bg-vital-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vital-primary-dark disabled:opacity-60"
      />
    </form>
  );
}
