import LoginForm from "./LoginForm";

export const metadata = {
  title: "Entrar — Ecossistema Vital",
  description: "Acesse sua conta do Ecossistema Vital.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="rounded-xl border border-vital-gold/40 bg-vital-cream p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-vital-primary">
          Bem-vindo de volta
        </p>
        <h1 className="mt-2 text-2xl font-bold text-vital-primary-darker">
          Entrar na sua conta
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Acesse seu ecossistema financeiro com seu e-mail e senha.
        </p>

        <div className="mt-6">
          <LoginForm nextPath={typeof next === "string" ? next : ""} />
        </div>
      </div>
    </section>
  );
}
