export default function Home() {
  return (
    <section className="flex flex-col items-start gap-6">
      <div className="rounded-xl border border-vital-gold/40 bg-vital-cream p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-vital-primary">
          Bem-vindo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-vital-primary-darker">
          Entenda o porquê. Decida melhor. Evolua.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          O Ecossistema Vital é uma plataforma de inteligência financeira
          pessoal. Esta é a fundação da aplicação de produção (Fase 1): o
          núcleo financeiro será construído sobre este layout, com dados reais
          do usuário — sem demonstrações, sem atalhos.
        </p>
      </div>
      <p className="text-sm text-zinc-500">
        Use a navegação acima para acessar as áreas da plataforma.
      </p>
    </section>
  );
}
