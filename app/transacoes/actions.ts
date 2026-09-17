"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIAS,
  METODO_PAGAMENTO_VALUES,
  formatUSD,
  parseAmountInput,
} from "@/lib/finance/format";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const REVALIDATE_PATHS = ["/transacoes", "/visao", "/relatorio-porque"] as const;

function revalidateFinance() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  return parseAmountInput(raw);
}

function isValidDate(raw: FormDataEntryValue | null): raw is string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(`${raw}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

interface ValidTx {
  type: "receita" | "despesa";
  description: string;
  amount: number;
  category: string;
  date: string;
  payment_method: string | null;
}

function validateTxForm(formData: FormData): ValidTx | { error: string } {
  const type = formData.get("type");
  if (type !== "receita" && type !== "despesa") {
    return { error: "Tipo inválido: escolha receita ou despesa." };
  }
  const description = (formData.get("description") ?? "").toString().trim();
  if (!description) return { error: "A descrição é obrigatória." };
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { error: "Informe um valor maior que zero." };
  const category = (formData.get("category") ?? "").toString();
  if (!(CATEGORIAS as readonly string[]).includes(category)) {
    return { error: "Escolha uma categoria válida." };
  }
  const date = formData.get("date");
  if (!isValidDate(date)) return { error: "Informe uma data válida." };
  const pmRaw = (formData.get("payment_method") ?? "").toString();
  const payment_method: string | null =
    pmRaw === ""
      ? null
      : (METODO_PAGAMENTO_VALUES as readonly string[]).includes(pmRaw)
        ? pmRaw
        : null;
  if (pmRaw !== "" && payment_method === null) {
    return { error: "Forma de pagamento inválida." };
  }
  return { type, description, amount, category, date, payment_method };
}

/**
 * Resultado das RPCs atômicas de transação
 * (supabase/migrations/20260917000001_atomic_transactions.sql).
 */
interface AtomicTxResult {
  ok: boolean;
  reason?: string;
  id?: string;
}

function duplicateMessage(description: string, amount: number): string {
  return (
    `Lançamento duplicado: já existe um lançamento igual ("${description}", ` +
    `${formatUSD(amount)}) criado há menos de 5 minutos.`
  );
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const parsed = validateTxForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Inserção ATÔMICA via RPC: checagem anti-duplicata + INSERT na mesma
  // transação, serializados por advisory lock por usuário. Elimina a corrida
  // check-then-insert (dois lançamentos iguais simultâneos -> só um vence).
  const { data, error } = await supabase.rpc("create_transaction_if_unique", {
    p_user_id: user.id,
    p_type: parsed.type,
    p_description: parsed.description,
    p_amount: parsed.amount,
    p_category: parsed.category,
    p_date: parsed.date,
    p_payment_method: parsed.payment_method,
  });

  if (error) return { ok: false, error: "Não foi possível salvar o lançamento." };

  const result = data as AtomicTxResult | null;
  if (!result?.ok) {
    if (result?.reason === "duplicado") {
      return {
        ok: false,
        error: duplicateMessage(parsed.description, parsed.amount),
      };
    }
    return { ok: false, error: "Não foi possível salvar o lançamento." };
  }

  revalidateFinance();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível excluir o lançamento." };

  revalidateFinance();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fluxo MANUAL de nota fiscal (honesto, sem OCR)
// ---------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function uploadReceipt(
  formData: FormData,
): Promise<ActionResult & { draftId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolha uma foto da nota fiscal." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "O arquivo precisa ser uma imagem." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "A foto deve ter no máximo 10 MB." };
  }

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { ok: false, error: "Não foi possível enviar a foto. Tente de novo." };
  }

  const { data, error } = await supabase
    .from("receipt_drafts")
    .insert({
      user_id: user.id,
      photo_path: path,
      status: "manual",
      fields: {},
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("receipts").remove([path]);
    return { ok: false, error: "Não foi possível criar o rascunho." };
  }

  revalidatePath("/transacoes");
  return { ok: true, draftId: data.id };
}

function validateDraftForm(formData: FormData): ValidTx | { error: string } {
  // O formulário do rascunho usa os mesmos nomes de campo do lançamento,
  // com "estabelecimento" mapeado para "description".
  const description = (formData.get("estabelecimento") ?? "").toString().trim();
  const adapted = new FormData();
  for (const [k, v] of formData.entries()) adapted.append(k, v);
  adapted.set("description", description);
  adapted.set("type", "despesa");
  return validateTxForm(adapted);
}

export async function createFromDraft(
  draftId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const parsed = validateDraftForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Conversão ATÔMICA via RPC: claim do rascunho (UPDATE ... WHERE
  // status='manual') + anti-duplicata + INSERT na mesma transação,
  // serializados por advisory locks (usuário -> rascunho). Duas conversões
  // simultâneas do mesmo rascunho -> só uma vence; a outra recebe
  // "rascunho_ja_convertido".
  const { data, error } = await supabase.rpc("convert_receipt_draft", {
    p_draft_id: draftId,
    p_description: parsed.description,
    p_amount: parsed.amount,
    p_category: parsed.category,
    p_date: parsed.date,
    p_payment_method: parsed.payment_method,
  });

  if (error) return { ok: false, error: "Não foi possível criar o lançamento." };

  const result = data as AtomicTxResult | null;
  if (!result?.ok) {
    switch (result?.reason) {
      case "duplicado":
        return {
          ok: false,
          error: duplicateMessage(parsed.description, parsed.amount),
        };
      case "rascunho_ja_convertido":
        return { ok: false, error: "Este rascunho já foi convertido." };
      case "rascunho_nao_encontrado":
      default:
        return { ok: false, error: "Rascunho não encontrado." };
    }
  }

  revalidateFinance();
  return { ok: true };
}

export async function deleteDraft(draftId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const { data: draft } = await supabase
    .from("receipt_drafts")
    .select("id, photo_path")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  if (!draft) return { ok: false, error: "Rascunho não encontrado." };
  if (draft.photo_path) {
    await supabase.storage.from("receipts").remove([draft.photo_path]);
  }
  const { error } = await supabase
    .from("receipt_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível descartar o rascunho." };

  revalidatePath("/transacoes");
  return { ok: true };
}
