"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error?: string;
}

/** Traduz os erros mais comuns do Supabase Auth para PT-BR honesto. */
function toPtBr(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "E-mail ou senha incorretos. Confira e tente novamente.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Você ainda não confirmou seu e-mail. Confira a caixa de entrada (e o spam).";
  }
  if (/too many requests|rate limit/i.test(message)) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  return "Não foi possível entrar agora. Tente novamente em instantes.";
}

/** Só aceita redireciono pós-login para caminhos internos (anti open-redirect). */
function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/visao";
}

/**
 * Garante a linha de user_settings do usuário (idempotente via upsert).
 * O RLS permite ao próprio usuário autenticado inserir/atualizar a própria linha.
 */
async function ensureUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, currency: "USD", locale: "pt-BR" },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[login] falha ao garantir user_settings:", error.message);
  }
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Informe seu e-mail e sua senha." };
  }

  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[login]", err);
    return {
      error:
        "Serviço de login indisponível no momento (configuração do servidor). Tente mais tarde.",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: toPtBr(error?.message ?? "") };
  }

  await ensureUserSettings(supabase, data.user.id);

  redirect(next);
}
