import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Guarda de rotas do Ecossistema Vital (convenção "proxy" do Next.js 16).
 *
 * - Atualiza a sessão Supabase em TODA requisição (refresh automático do
 *   token via updateSession — sessão longa sem novo login).
 * - Visitante não autenticado em rota protegida -> /login (com `?next=` para
 *   voltar depois de entrar).
 * - Usuário autenticado em /login ou /cadastro -> /visao (não faz sentido
 *   ver tela de entrada já estando dentro).
 *
 * Rotas protegidas: /, /visao, /transacoes, /relatorio-porque, /dividas, /macro
 * Rotas públicas: /login, /cadastro (+ /api/* fora do matcher).
 */
const PROTECTED_PATHS = [
  "/",
  "/visao",
  "/transacoes",
  "/relatorio-porque",
  "/dividas",
  "/macro",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

export default async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/cadastro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/visao";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)"],
};
