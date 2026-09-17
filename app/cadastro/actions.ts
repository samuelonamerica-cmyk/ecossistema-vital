"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verifyChallengeAnswer, COOKIE_NAME } from "@/lib/desafio";

export interface SignUpState {
  error?: string;
}

function challengeErrorPtBr(
  reason: "ausente" | "formato" | "assinatura" | "expirado" | "incorreta",
): string {
  switch (reason) {
    case "ausente":
    case "expirado":
      return "O desafio de segurança expirou. Recarregue a página e tente de novo.";
    case "assinatura":
    case "formato":
      return "O desafio de segurança é inválido. Recarregue a página e tente de novo.";
    case "incorreta":
      return "A resposta do desafio está incorreta. Tente de novo.";
  }
}

function signUpErrorPtBr(message: string): string {
  if (/already registered|already exists|user already/i.test(message)) {
    return "Este e-mail já está cadastrado. Tente entrar na sua conta.";
  }
  if (/password.*(short|weak|length)|weak password/i.test(message)) {
    return "A senha não atende aos requisitos de segurança. Use no mínimo 8 caracteres.";
  }
  if (/invalid email|email.*invalid/i.test(message)) {
    return "Informe um e-mail válido.";
  }
  if (/too many requests|rate limit/i.test(message)) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  return "Não foi possível criar sua conta agora. Tente novamente em instantes.";
}

export async function signUp(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const challengeAnswer = String(formData.get("challengeAnswer") ?? "");

  // --- Validações de formulário (servidor; o cliente repete por usabilidade) ---
  if (name.length < 2) {
    return { error: "Informe seu nome." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter no mínimo 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "A senha e a confirmação não são iguais." };
  }

  // --- Desafio matemático: validado 100% no servidor via cookie assinado ---
  const cookieStore = await cookies();
  let check: ReturnType<typeof verifyChallengeAnswer>;
  try {
    check = verifyChallengeAnswer(cookieStore.get(COOKIE_NAME)?.value, challengeAnswer);
  } catch (err) {
    console.error("[cadastro] desafio:", err);
    return {
      error:
        "Serviço de cadastro indisponível no momento (configuração do servidor). Tente mais tarde.",
    };
  }
  if (!check.ok) {
    return { error: challengeErrorPtBr(check.reason) };
  }

  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[cadastro]", err);
    return {
      error:
        "Serviço de cadastro indisponível no momento (configuração do servidor). Tente mais tarde.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome: name } },
  });

  if (error || !data.user) {
    return { error: signUpErrorPtBr(error?.message ?? "") };
  }

  // O signUp pode não abrir sessão imediata (ex.: confirmação de e-mail
  // ativada no projeto). Nesse caso, tentamos o login direto; se falhar,
  // dizemos a verdade: a conta foi criada, falta confirmar o e-mail.
  let userId: string | undefined = data.session?.user.id;
  if (!userId) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (sessionError || !sessionData.user) {
      return {
        error:
          "Conta criada! Agora confirme seu e-mail (verifique a caixa de entrada e o spam) e entre na sua conta.",
      };
    }
    userId = sessionData.user.id;
  }

  // Cria a linha de user_settings (moeda USD, idioma pt-BR).
  // Upsert idempotente; o RLS permite ao próprio usuário autenticado.
  const { error: settingsError } = await supabase.from("user_settings").upsert(
    { user_id: userId, currency: "USD", locale: "pt-BR" },
    { onConflict: "user_id" },
  );
  if (settingsError) {
    console.error("[cadastro] user_settings:", settingsError.message);
    // Não bloqueia o cadastro: o login também garante a linha (idempotente).
  }

  // Desafio consumido: invalida o cookie.
  cookieStore.delete(COOKIE_NAME);

  redirect("/visao");
}
