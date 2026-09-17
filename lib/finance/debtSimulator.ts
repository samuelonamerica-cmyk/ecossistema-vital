/**
 * Ecossistema Vital — Núcleo Financeiro (Fase 1)
 * lib/finance/debtSimulator.ts
 *
 * Simulador avalanche vs. snowball — matemática exata, sem arredondamento
 * silencioso:
 *
 *  - Todos os valores são manipulados em CENTAVOS INTEIROS internamente.
 *  - Juros de cada mês: balance_cents * (annual_rate_pct / 100 / 12),
 *    ARREDONDADO PARA O CENTAVO MAIS PRÓXIMO (half-up, Math.round) — regra
 *    declarada aqui e aplicada de forma idêntica todo mês.
 *  - Ordem de cada mês: (1) aplica juros, (2) paga os mínimos em todas as
 *    dívidas, (3) aloca o excedente mensal na dívida-alvo.
 *  - Estratégias: "avalanche" (maior taxa primeiro), "snowball" (menor
 *    saldo primeiro), "minimos" (só mínimos, sem excedente — cenário-base).
 *  - Desempates determinísticos: avalanche → maior taxa, depois menor saldo,
 *    depois ordem de entrada; snowball → menor saldo, depois maior taxa,
 *    depois ordem de entrada.
 *  - Se os mínimos não cobrem os juros (amortização negativa), a dívida
 *    nunca é quitada: após o horizonte de 1200 meses o resultado sai com
 *    paidOff=false e months=null (honesto, sem travar).
 *
 * Funções puras: sem dependências externas, testáveis em Node.
 */

export interface DebtInput {
  id: string;
  creditor: string;
  /** Saldo devedor em centavos (>= 0). */
  balanceCents: number;
  /** Taxa de juros anual em % (ex.: 24 = 24% a.a.). */
  annualRatePct: number;
  /** Pagamento mínimo mensal em centavos (>= 0). */
  minimumPaymentCents: number;
}

export type DebtStrategy = "avalanche" | "snowball" | "minimos";

export interface SimulationResult {
  strategy: DebtStrategy;
  /** Meses até quitar tudo; null quando não quita dentro do horizonte. */
  months: number | null;
  paidOff: boolean;
  /** Total de juros pagos, em centavos. */
  totalInterestCents: number;
  /** Total pago (principal + juros), em centavos. */
  totalPaidCents: number;
  /** Ids das dívidas na ordem em que foram quitadas. */
  payoffOrder: string[];
}

/** Linha opcional de trilha mensal (para testes/auditoria). */
export interface SimulationMonthTrace {
  month: number;
  balancesCents: number[];
  interestChargedCents: number;
  paidCents: number;
}

/** Horizonte máximo da simulação: 100 anos. */
export const MAX_SIMULATION_MONTHS = 1200;

interface MutableDebt extends DebtInput {
  balance: number;
}

function pickTarget(debts: MutableDebt[], strategy: DebtStrategy): MutableDebt | null {
  const open = debts.filter((d) => d.balance > 0);
  if (open.length === 0) return null;
  if (strategy === "avalanche") {
    return open.reduce((best, d) => {
      if (d.annualRatePct !== best.annualRatePct)
        return d.annualRatePct > best.annualRatePct ? d : best;
      if (d.balance !== best.balance) return d.balance < best.balance ? d : best;
      return best; // mantém a ordem de entrada (reduce preserva o primeiro)
    });
  }
  // snowball
  return open.reduce((best, d) => {
    if (d.balance !== best.balance) return d.balance < best.balance ? d : best;
    if (d.annualRatePct !== best.annualRatePct)
      return d.annualRatePct > best.annualRatePct ? d : best;
    return best;
  });
}

export interface SimulateOptions {
  /** Coletor opcional de trilha mensal (usado nos testes de verificação). */
  trace?: SimulationMonthTrace[];
}

/**
 * Simula o pagamento das dívidas mês a mês.
 *
 * @param debts              dívidas de entrada (não é mutado)
 * @param extraMonthlyCents  excedente mensal além dos mínimos (>= 0)
 * @param strategy           estratégia de alocação do excedente
 */
export function simulateDebts(
  debts: DebtInput[],
  extraMonthlyCents: number,
  strategy: DebtStrategy,
  options: SimulateOptions = {},
): SimulationResult {
  const state: MutableDebt[] = debts
    .filter((d) => d.balanceCents > 0)
    .map((d) => ({ ...d, balance: Math.round(d.balanceCents) }));

  const extra = Math.max(0, Math.round(extraMonthlyCents));
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  const payoffOrder: string[] = [];
  let months = 0;

  const allPaid = () => state.every((d) => d.balance <= 0);

  while (!allPaid() && months < MAX_SIMULATION_MONTHS) {
    months += 1;
    let monthInterest = 0;
    let monthPaid = 0;

    // 1) Juros compostos do mês (taxa mensal = anual / 12), centavo exato.
    for (const d of state) {
      if (d.balance <= 0) continue;
      const monthlyRate = d.annualRatePct / 100 / 12;
      const interest = Math.round(d.balance * monthlyRate);
      d.balance += interest;
      monthInterest += interest;
    }
    totalInterestCents += monthInterest;

    // 2) Pagamentos mínimos em todas as dívidas.
    for (const d of state) {
      if (d.balance <= 0) continue;
      const pay = Math.min(Math.round(d.minimumPaymentCents), d.balance);
      d.balance -= pay;
      monthPaid += pay;
      if (d.balance === 0) payoffOrder.push(d.id);
    }

    // 3) Excedente alocado na dívida-alvo da estratégia.
    if (strategy !== "minimos" && extra > 0) {
      let remaining = extra;
      while (remaining > 0) {
        const target = pickTarget(state, strategy);
        if (!target) break;
        const pay = Math.min(remaining, target.balance);
        target.balance -= pay;
        monthPaid += pay;
        remaining -= pay;
        if (target.balance === 0) payoffOrder.push(target.id);
      }
    }

    totalPaidCents += monthPaid;

    if (options.trace) {
      options.trace.push({
        month: months,
        balancesCents: state.map((d) => d.balance),
        interestChargedCents: monthInterest,
        paidCents: monthPaid,
      });
    }

    // Trava de segurança contra amortização negativa eterna: se num mês
    // inteiro nenhum saldo diminuiu, não há como quitar — encerra honesto.
    // (O while já sairia no horizonte; esta checagem só antecipa.)
    if (monthPaid === 0 && monthInterest >= 0) break;
  }

  const paidOff = allPaid();
  return {
    strategy,
    months: paidOff ? months : null,
    paidOff,
    totalInterestCents,
    totalPaidCents,
    payoffOrder,
  };
}

export interface DebtComparison {
  avalanche: SimulationResult;
  snowball: SimulationResult;
  minimos: SimulationResult;
  /** Melhor estratégia pelo critério de juros totais (entre avalanche/snowball). */
  bestByInterest: "avalanche" | "snowball";
  /** Juros economizados da melhor estratégia vs. só mínimos (centavos). */
  interestSavedVsMinimosCents: number;
  /** Meses economizados da melhor estratégia vs. só mínimos (null se indefinido). */
  monthsSavedVsMinimos: number | null;
}

/**
 * Roda as três estratégias com o mesmo excedente mensal e compara com o
 * cenário-base "só mínimos".
 */
export function compareStrategies(
  debts: DebtInput[],
  extraMonthlyCents: number,
): DebtComparison {
  const avalanche = simulateDebts(debts, extraMonthlyCents, "avalanche");
  const snowball = simulateDebts(debts, extraMonthlyCents, "snowball");
  const minimos = simulateDebts(debts, extraMonthlyCents, "minimos");

  const bestByInterest: "avalanche" | "snowball" =
    avalanche.totalInterestCents <= snowball.totalInterestCents
      ? "avalanche"
      : "snowball";
  const best = bestByInterest === "avalanche" ? avalanche : snowball;

  return {
    avalanche,
    snowball,
    minimos,
    bestByInterest,
    interestSavedVsMinimosCents:
      minimos.totalInterestCents - best.totalInterestCents,
    monthsSavedVsMinimos:
      minimos.months !== null && best.months !== null
        ? minimos.months - best.months
        : null,
  };
}
