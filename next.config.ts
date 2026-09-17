import type { NextConfig } from "next";

/**
 * Ecossistema Vital — headers de segurança aplicados a TODAS as rotas.
 *
 * Sem dependências novas (recursos nativos do Next.js).
 *
 * - X-Frame-Options: DENY — a aplicação nunca pode ser embutida em iframe
 *   de terceiros (mitiga clickjacking; nada no app precisa de framing).
 * - X-Content-Type-Options: nosniff — impede MIME-sniffing do navegador.
 * - Content-Security-Policy: básica e funcional. Não quebra o app porque:
 *   - script/style 'unsafe-inline' são exigidos pela hidratação do Next.js
 *     e pelos estilos inline (styled-jsx/Tailwind);
 *   - connect-src libera apenas o próprio domínio (self, ex.: /api/desafio)
 *     e o Supabase (https://*.supabase.co) — as chamadas ao BCB acontecem
 *     no servidor (Route Handlers), não no navegador, então não entram na CSP;
 *   - nenhuma fonte externa (Google Fonts, CDN) é usada: o app usa só
 *     fontes/estilos locais e o logo em /public.
 */
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
