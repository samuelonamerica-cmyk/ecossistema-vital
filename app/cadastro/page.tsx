import CadastroForm from "./CadastroForm";

export const metadata = {
  title: "Criar conta — Ecossistema Vital",
  description: "Crie sua conta gratuita no Ecossistema Vital.",
};

export default function CadastroPage() {
  return (
    <section className="mx-auto w-full max-w-md">
      <div className="rounded-xl border border-vital-gold/40 bg-vital-cream p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-vital-primary">
          Comece grátis
        </p>
        <h1 className="mt-2 text-2xl font-bold text-vital-primary-darker">
          Criar sua conta
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Leva menos de um minuto. Seus dados ficam protegidos na sua conta.
        </p>

        <div className="mt-6">
          <CadastroForm />
        </div>
      </div>
    </section>
  );
}
