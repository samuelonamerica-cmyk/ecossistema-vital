/**
 * Ecossistema Vital — desafio matemático anti-bot (cadastro).
 *
 * SOMENTE SERVIDOR: este módulo é importado apenas por Route Handlers e
 * Server Actions. Nunca o importe em Client Components — ele lê APP_SECRET.
 *
 * Mecanismo (honesto e simples):
 * 1. GET /api/desafio gera dois números aleatórios (a, b) e calcula ans = a + b.
 * 2. A resposta esperada NUNCA vai para o cliente em claro: ela é embutida
 *    num cookie httpOnly chamado `vital_desafio`, cujo conteúdo é
 *    `payload_base64url . hmac_sha256(payload, APP_SECRET)`.
 * 3. O formulário mostra apenas "Quanto é a + b?" e o usuário digita a resposta.
 * 4. A Server Action de cadastro lê o cookie, revalida o HMAC com
 *    comparação em tempo constante (timingSafeEqual), checa expiração
 *    (15 min) e compara a resposta digitada com a esperada.
 *
 * Sem o APP_SECRET, ninguém consegue forjar um cookie válido — a validação
 * acontece 100% no servidor. Não há validação apenas no cliente.
 */
import { createHmac, timingSafeEqual, randomInt } from "node:crypto";

export const COOKIE_NAME = "vital_desafio";
export const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MIN_OPERAND = 2;
const MAX_OPERAND = 20; // randomInt é exclusivo no limite superior

interface ChallengePayload {
  a: number;
  b: number;
  ans: number;
  exp: number; // timestamp (ms) de expiração
}

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "APP_SECRET ausente ou curta demais: defina um valor aleatório " +
        "longo no .env.local (ex.: openssl rand -hex 32).",
    );
  }
  return s;
}

function encodePayload(p: ChallengePayload): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload, "utf8").digest("hex");
}

/**
 * Gera um desafio novo: retorna o valor do cookie assinado e os operandos
 * a exibir no formulário.
 */
export function createChallengeCookieValue(): {
  value: string;
  a: number;
  b: number;
} {
  const a = randomInt(MIN_OPERAND, MAX_OPERAND + 1);
  const b = randomInt(MIN_OPERAND, MAX_OPERAND + 1);
  const payload = encodePayload({ a, b, ans: a + b, exp: Date.now() + CHALLENGE_TTL_MS });
  return { value: `${payload}.${sign(payload)}`, a, b };
}

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "ausente" | "formato" | "assinatura" | "expirado" | "incorreta";
    };

/**
 * Valida a resposta digitada contra o cookie assinado. Pode lançar se
 * APP_SECRET não estiver configurada — quem chama deve tratar e responder
 * com erro honesto de indisponibilidade.
 */
export function verifyChallengeAnswer(
  cookieValue: string | undefined,
  answer: string,
): VerifyResult {
  if (!cookieValue) return { ok: false, reason: "ausente" };

  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "formato" };

  const payload = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = sign(payload);

  let signatureOk = false;
  try {
    signatureOk =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: "assinatura" };

  let parsed: ChallengePayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ChallengePayload;
  } catch {
    return { ok: false, reason: "formato" };
  }

  if (
    typeof parsed.exp !== "number" ||
    typeof parsed.ans !== "number" ||
    Date.now() > parsed.exp
  ) {
    return { ok: false, reason: "expirado" };
  }

  const given = Number.parseInt(answer.trim(), 10);
  if (!Number.isFinite(given) || given !== parsed.ans) {
    return { ok: false, reason: "incorreta" };
  }

  return { ok: true };
}
