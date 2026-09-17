import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ecossistema Vital",
  description:
    "Plataforma de inteligência financeira pessoal: entenda o porquê, decida melhor, evolua.",
};

const NAV = [
  { href: "/visao", label: "Visão" },
  { href: "/transacoes", label: "Transações" },
  { href: "/relatorio-porque", label: "Relatório Porquê" },
  { href: "/dividas", label: "Dívidas" },
  { href: "/macro", label: "Macro" },
] as const;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Sessão atual (server): mostra "Sair" para quem está logado e "Entrar"
  // para visitantes. Falha silenciosa -> trata como visitante.
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <header className="border-b-2 border-vital-gold bg-vital-primary">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Logo Ecossistema Vital"
                width={1920}
                height={1280}
                className="h-11 w-auto rounded-md bg-white p-1"
                priority
              />
              <span className="text-xl font-bold tracking-tight text-white">
                Ecossistema Vital
              </span>
            </Link>
            <nav
              aria-label="Navegação principal"
              className="ml-auto hidden items-center gap-1 sm:flex"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-emerald-50 transition-colors hover:bg-vital-primary-dark hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <SignOutButton />
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-vital-gold px-3 py-2 text-sm font-semibold text-vital-primary-darker transition-colors hover:bg-vital-gold-soft"
                >
                  Entrar
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-zinc-200 bg-vital-cream">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Ecossistema Vital — inteligência financeira pessoal. Fase 1:
              fundação + núcleo financeiro.
            </p>
            <p>
              Conteúdo educativo. Não constitui recomendação de investimento.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
