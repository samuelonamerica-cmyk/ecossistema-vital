"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  compareStrategies,
  type DebtInput,
  type SimulationResult,
} from "@/lib/finance/debtSimulator";
import { parseNonNegativeInput } from "@/lib/finance/format";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ValidDebt {
  creditor: string;
  balance: number;
  annual_rate_pct: number;
  minimum_payment: number;
}

function parseRate(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0 || v > 999.999) return null;
  return v;
}

function validateDebtForm(formData: FormData): ValidDebt | { error: string } {
  const creditor = (formData.get("creditor") ?? "").toString().trim();
  if (!creditor) return { error: "Informe o credor (ex.: Cartão Banco X)." };

  const balanceRaw = formData.get("balance");
  const balance =
    typeof balanceRaw === "string" ? parseNonNegativeInput(balanceRaw) : null;
  if (balance === null) return { error: "Informe um saldo válido (zero ou maior)." };

  const annual_rate_pct = parseRate(formData.get("annual_rate_pct"));
  if (annual_rate_pct === null) {
    return { error: "Informe os juros em % a.a. (ex.: 24 ou 12,5)." };
  }

  const minRaw = formData.get("minimum_payment");
  const minimum_payment =
    typeof minRaw === "string" ? parseNonNegativeInput(minRaw) : null;
  if (minimum_payment === null) {
    return { error: "Informe um pagamento mínimo válido (zero ou maior)." };
  }

  return { creditor, balance, annual_rate_pct, minimum_payment };
}

export async function createDebt(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const parsed = validateDebtForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    creditor: parsed.creditor,
    balance: parsed.balance,
    annual_rate_pct: parsed.annual_rate_pct,
    minimum_payment: parsed.minimum_payment,
  });

  if (error) return { ok: false, error: "Não foi possível salvar a dívida." };

  revalidatePath("/dividas");
  return { ok: true };
}

export async function updateDebt(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const parsed = validateDebtForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { error } = await supabase
    .from("debts")
    .update({
      creditor: parsed.creditor,
      balance: parsed.balance,
      annual_rate_pct: parsed.annual_rate_pct,
      minimum_payment: parsed.minimum_payment,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível atualizar a dívida." };

  revalidatePath("/dividas");
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível excluir a dívida." };

  revalidatePath("/dividas");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Simulador (roda no servidor, sobre as dívidas reais do usuário)
// ---------------------------------------------------------------------------

export interface SimulationRowView {
  strategy: "avalanche" | "snowball" | "minimos";
  months: number | null;
  paidOff: boolean;
  totalInterestCents: number;
  totalPaidCents: number;
  payoffOrder: string[]; // nomes dos credores na ordem de quitação
}

export interface SimulationViewResult {
  ok: boolean;
  error?: string;
  avalanche?: SimulationRowView;
  snowball?: SimulationRowView;
  minimos?: SimulationRowView;
  bestByInterest?: "avalanche" | "snowball";
  interestSavedVsMinimosCents?: number;
  monthsSavedVsMinimos?: number | null;
}

function toRowView(
  r: SimulationResult,
  creditorById: Map<string, string>,
): SimulationRowView {
  return {
    strategy: r.strategy,
    months: r.months,
    paidOff: r.paidOff,
    totalInterestCents: r.totalInterestCents,
    totalPaidCents: r.totalPaidCents,
    payoffOrder: r.payoffOrder.map((id) => creditorById.get(id) ?? id),
  };
}

/**
 * Roda avalanche × snowball × só-mínimos sobre as dívidas atuais do usuário.
 * @param extraMonthlyRaw valor extra mensal em US$ (texto digitado)
 */
export async function runSimulation(extraMonthlyRaw: string): Promise<SimulationViewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const extra =
    extraMonthlyRaw.trim() === "" ? 0 : parseNonNegativeInput(extraMonthlyRaw);
  if (extra === null) {
    return { ok: false, error: "Informe um valor extra mensal válido (zero ou maior)." };
  }

  const { data, error } = await supabase
    .from("debts")
    .select("id, creditor, balance, annual_rate_pct, minimum_payment")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: "Não foi possível ler suas dívidas." };
  if (!data || data.length === 0) {
    return { ok: false, error: "Cadastre ao menos uma dívida para simular." };
  }

  const creditorById = new Map<string, string>();
  const inputs: DebtInput[] = data.map((d) => {
    creditorById.set(d.id as string, d.creditor as string);
    return {
      id: d.id as string,
      creditor: d.creditor as string,
      balanceCents: Math.round(Number(d.balance) * 100),
      annualRatePct: Number(d.annual_rate_pct),
      minimumPaymentCents: Math.round(Number(d.minimum_payment) * 100),
    };
  });

  const comparison = compareStrategies(inputs, Math.round(extra * 100));

  return {
    ok: true,
    avalanche: toRowView(comparison.avalanche, creditorById),
    snowball: toRowView(comparison.snowball, creditorById),
    minimos: toRowView(comparison.minimos, creditorById),
    bestByInterest: comparison.bestByInterest,
    interestSavedVsMinimosCents: comparison.interestSavedVsMinimosCents,
    monthsSavedVsMinimos: comparison.monthsSavedVsMinimos,
  };
}
