"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signUp, type SignUpState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-vital-primary focus:outline-none " +
  "focus:ring-2 focus:ring-vital-primary/30";

interface Challenge {
  a: number;
  b: number;
}

export default function CadastroForm() {
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    signUp,
    {},
  );
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<
    "carregando" | "ok" | "erro"
  >("carregando");

  const loadChallenge = async () => {
    setChallengeStatus("carregando");
    try {
      const res = await fetch("/api/desafio", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Challenge;
      setChallenge(data);
      setChallengeStatus("ok");
    } catch {
      setChallenge(null);
      setChallengeStatus("erro");
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch("/api/desafio", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Challenge;
        if (active) {
          setChallenge(data);
          setChallengeStatus("ok");
        }
      } catch {
        if (active) {
          setChallenge(null);
          setChallengeStatus("erro");
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          placeholder="Seu nome"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@exemplo.com"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Senha (mínimo 8 caracteres)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Crie uma senha"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repita a senha"
          className={inputClass}
        />
      </div>

      <fieldset className="rounded-lg border border-vital-gold/50 bg-white p-4">
        <legend className="px-1 text-sm font-medium text-zinc-700">
          Verificação anti-robô
        </legend>
        {challengeStatus === "carregando" && (
          <p className="text-sm text-zinc-500">Gerando desafio...</p>
        )}
        {challengeStatus === "erro" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              Não foi possível gerar o desafio de segurança.
            </p>
            <button
              type="button"
              onClick={() => void loadChallenge()}
              className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Tentar de novo
            </button>
          </div>
        )}
        {challengeStatus === "ok" && challenge && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-600">
              Para provar que você não é um robô, responda:{" "}
              <strong className="text-zinc-900">
                Quanto é {challenge.a} + {challenge.b}?
              </strong>
            </p>
            <div className="flex items-center gap-2">
              <input
                id="challengeAnswer"
                name="challengeAnswer"
                type="number"
                inputMode="numeric"
                required
                placeholder="Sua resposta"
                aria-label={`Quanto é ${challenge.a} mais ${challenge.b}?`}
                className={`${inputClass} max-w-40`}
              />
              <button
                type="button"
                onClick={() => void loadChallenge()}
                title="Gerar outro desafio"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Trocar
              </button>
            </div>
          </div>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || challengeStatus !== "ok"}
        className="rounded-lg bg-vital-primary px-4 py-2.5 font-semibold text-white transition-colors hover:bg-vital-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-center text-sm text-zinc-600">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-vital-primary underline decoration-vital-gold decoration-2 underline-offset-2 hover:text-vital-primary-dark"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
