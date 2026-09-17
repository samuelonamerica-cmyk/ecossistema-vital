"use server";

import { revalidatePath } from "next/cache";
import { getMacroPanel } from "@/lib/macro/refresh";

/**
 * Ação do botão "Atualizar indicadores".
 * Passa force=true: ignora a exigência do botão, mas a camada de cache
 * (lib/macro/refresh.ts) ainda só chama o BCB se os dados tiverem mais
 * de 6h ou a última tentativa tiver falhado.
 */
export async function refreshMacroIndicators(): Promise<void> {
  await getMacroPanel({ force: true });
  revalidatePath("/macro");
}
