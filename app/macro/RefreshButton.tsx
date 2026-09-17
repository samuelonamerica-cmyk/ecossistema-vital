"use client";

import { useTransition } from "react";
import { refreshMacroIndicators } from "./actions";

/** Botão "Atualizar indicadores" — respeita o cache de 6h do servidor. */
export default function RefreshButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <form
        action={() => {
          startTransition(async () => {
            await refreshMacroIndicators();
          });
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-vital-primary px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-vital-primary-dark disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Atualizando…" : "Atualizar indicadores"}
        </button>
      </form>
      <p className="text-xs text-zinc-500">
        Os dados são atualizados no máximo a cada 6 horas. Se já estiverem
        recentes, o botão apenas recarrega a tela sem nova busca no BCB.
      </p>
    </div>
  );
}
