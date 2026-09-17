import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Atualiza a sessão Supabase dentro do middleware.
 *
 * NOTA: este helper existe separado de lib/supabase/server.ts de propósito.
 * O server.ts usa `cookies()` de next/headers, que no middleware não propaga
 * escritas para a resposta. Aqui seguimos o padrão oficial do @supabase/ssr:
 * o mesmo cliente, mas com os cookies lidos do request e escritos no
 * response — é isso que permite o refresh automático do access token
 * (via refresh token) a cada navegação, mantendo a sessão longa.
 *
 * Retorna a resposta (já com os cookies de sessão atualizados, se houve
 * refresh) e o usuário autenticado — ou null quando não há sessão válida.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida o token no servidor Supabase e dispara o refresh
  // automático quando o access token expirou (o novo par de tokens é
  // gravado nos cookies da resposta acima).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
