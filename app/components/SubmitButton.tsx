"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit que reflete o estado `pending` do formulário pai.
 * Deve ser renderizado dentro do <form> cujo action está em andamento.
 */
export default function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
