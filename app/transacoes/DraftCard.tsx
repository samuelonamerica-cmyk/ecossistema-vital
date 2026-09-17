"use client";

import Image from "next/image";
import { useState } from "react";
import SubmitButton from "../components/SubmitButton";
import { createFromDraft, deleteDraft } from "./actions";
import { CATEGORIAS, METODOS_PAGAMENTO } from "@/lib/finance/format";

export interface DraftView {
  id: string;
  photoUrl: string | null;
  createdAt: string;
}

function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function DraftCard({ draft }: { draft: DraftView }) {
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);

  async function handleSubmit(formData: FormData) {
    const result = await createFromDraft(draft.id, formData);
    if (result.ok) {
      setNotice({ kind: "ok", text: "Lançamento criado a partir do rascunho." });
    } else {
      setNotice({ kind: "error", text: result.error ?? "Não foi possível criar o lançamento." });
    }
  }

  async function handleDiscard() {
    if (!window.confirm("Descartar este rascunho e apagar a foto?")) return;
    setDiscarding(true);
    const result = await deleteDraft(draft.id);
    setDiscarding(false);
    if (!result.ok) setNotice({ kind: "error", text: result.error ?? "Não foi possível descartar." });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        {draft.photoUrl ? (
          <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg border border-zinc-200 sm:w-40">
            <Image
              src={draft.photoUrl}
              alt="Foto da nota fiscal anexada"
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
        ) : (
          <div className="flex h-40 w-full shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-500 sm:w-40">
            Foto indisponível
          </div>
        )}

        <form
          action={handleSubmit}
          onChange={() => setNotice(null)}
          className="grid flex-1 gap-3 sm:grid-cols-2"
        >
          <p className="text-sm text-zinc-600 sm:col-span-2">
            <strong className="text-zinc-800">Preenchimento manual.</strong> Olhe a foto e digite os
            campos — o sistema não extraiu nada da imagem.
          </p>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Estabelecimento</span>
            <input
              name="estabelecimento"
              type="text"
              required
              maxLength={120}
              placeholder="Ex.: Wawa #512"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Data da compra</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={localToday()}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-vital-primary focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Valor total (US$)</span>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="8,87"
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

          {notice && (
            <p
              role={notice.kind === "error" ? "alert" : "status"}
              className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${
                notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              }`}
            >
              {notice.text}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <SubmitButton
              label="Criar lançamento a partir do rascunho"
              pendingLabel="Criando…"
              className="flex-1 rounded-lg bg-vital-primary px-4 py-2 text-sm font-semibold text-white hover:bg-vital-primary-dark disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleDiscard}
              disabled={discarding}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
            >
              {discarding ? "Descartando…" : "Descartar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
