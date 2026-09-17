import { NextResponse } from "next/server";
import {
  createChallengeCookieValue,
  COOKIE_NAME,
  CHALLENGE_TTL_MS,
} from "@/lib/desafio";

/**
 * GET /api/desafio — emite o desafio matemático anti-bot do cadastro.
 *
 * Gera dois números aleatórios NO SERVIDOR e assina a resposta esperada com
 * HMAC (APP_SECRET) dentro de um cookie httpOnly. O cliente recebe apenas os
 * operandos (ex.: { a: 7, b: 5 }); a resposta esperada nunca trafega em claro.
 *
 * Se APP_SECRET não estiver configurada, responde 503 com mensagem honesta
 * em vez de emitir um desafio inseguro.
 */
export async function GET() {
  try {
    const { value, a, b } = createChallengeCookieValue();

    const res = NextResponse.json({ a, b });
    res.cookies.set(COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[/api/desafio]", err);
    return NextResponse.json(
      {
        error:
          "Serviço de cadastro indisponível no momento (configuração do servidor).",
      },
      { status: 503 },
    );
  }
}
