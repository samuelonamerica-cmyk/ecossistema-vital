"use client";

import { signOut } from "@/lib/actions/auth";

/** Botão "Sair" do cabeçalho: encerra a sessão via Server Action. */
export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md px-3 py-2 text-sm font-medium text-emerald-50 transition-colors hover:bg-vital-primary-dark hover:text-white"
      >
        Sair
      </button>
    </form>
  );
}
