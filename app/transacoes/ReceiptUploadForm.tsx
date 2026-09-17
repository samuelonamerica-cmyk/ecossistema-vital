"use client";

import { useRef, useState } from "react";
import SubmitButton from "../components/SubmitButton";
import { uploadReceipt } from "./actions";

export default function ReceiptUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await uploadReceipt(formData);
    if (result.ok) {
      formRef.current?.reset();
      setNotice({
        kind: "ok",
        text: "Foto enviada. Agora preencha os campos do rascunho abaixo — o sistema não lê a imagem automaticamente.",
      });
    } else {
      setNotice({ kind: "error", text: result.error ?? "Não foi possível enviar a foto." });
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onChange={() => setNotice(null)}
      className="rounded-xl border border-dashed border-vital-gold bg-vital-cream p-5"
    >
      <h2 className="text-lg font-semibold text-vital-primary-darker">Anexar foto da nota</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Envie a foto da nota fiscal e preencha os campos <strong>manualmente</strong>.{" "}
        <span className="font-medium">
          Preenchimento manual — a leitura automática virá numa fase futura.
        </span>{" "}
        O sistema <strong>não</strong> lê a imagem: você confere a foto e digita os valores.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          required
          className="w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-vital-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-vital-primary-dark"
        />
        <SubmitButton
          label="Enviar foto"
          pendingLabel="Enviando…"
          className="shrink-0 rounded-lg bg-vital-primary px-4 py-2 text-sm font-semibold text-white hover:bg-vital-primary-dark disabled:opacity-60"
        />
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </p>
      )}
    </form>
  );
}
