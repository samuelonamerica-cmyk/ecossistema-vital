/**
 * Ecossistema Vital — Núcleo Financeiro (Fase 1)
 * lib/why/engine.ts
 *
 * RELATÓRIO PORQUÊ — motor 100% DETERMINÍSTICO (compute-then-verbalize).
 *
 *  1. COMPUTE: agrega fatos numéricos a partir das transações (e dívidas
 *     opcionais): totais, top categoria, maior gasto, variação mensal,
 *     categoria que mais cresceu, comprometimento com dívidas.
 *  2. VERBALIZE: transforma os fatos em texto PT-BR com regras fixas de
 *     redação — ZERO IA, ZERO chamada externa, mesma entrada => mesma saída.
 *
 * Funções puras: sem dependências externas, testáveis em Node.
 */

export interface WhyTransaction {
  type: "receita" | "despesa";
  description: string;
  /** Valor em unidades (ex.: 10.87). */
  amount: number;
  category: string;
  /** "YYYY-MM-DD". */
  date: string;
}

export interface WhyDebt {
  creditor: string;
  balance: number;
  annualRatePct: number;
  minimumPayment: number;
}

export interface WhyFacts {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  mesesAnalisados: number;
  topCategoria: string | null;
  topCategoriaTotal: number;
  /** % das despesas totais concentrada na top categoria (0-100). */
  topCategoriaPct: number;
  maiorGasto: { description: string; amount: number; date: string } | null;
  /** Variação % das despesas do mês mais recente vs. o anterior (null sem 2+ meses). */
  variacaoMensalPct: number | null;
  mesRecente: string | null;
  mesAnterior: string | null;
  categoriaQueMaisCresceu: { categoria: string; crescimentoPct: number } | null;
  /** Soma dos pagamentos mínimos / receita média mensal, em % (null sem base). */
  comprometimentoDividasPct: number | null;
  totalMinimosDividas: number;
}

export interface WhySection {
  title: string;
  paragraphs: string[];
}

export interface WhyReport {
  generatedAtISO: string;
  hasData: boolean;
  facts: WhyFacts;
  sections: WhySection[];
}

const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
});
const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function fmtMoney(v: number): string {
  return usd.format(v);
}
function fmtPct(fraction: number): string {
  return pct.format(fraction);
}
function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** "2026-07" -> "jul/26" (rótulo em pt-BR). */
function monthLabelPtBR(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(y, m - 1, 1))
    .replace(".", "");
  return `${label}/${String(y).slice(2)}`;
}

function computeFacts(
  transactions: WhyTransaction[],
  debts: WhyDebt[],
): WhyFacts {
  const empty: WhyFacts = {
    totalReceitas: 0,
    totalDespesas: 0,
    saldo: 0,
    mesesAnalisados: 0,
    topCategoria: null,
    topCategoriaTotal: 0,
    topCategoriaPct: 0,
    maiorGasto: null,
    variacaoMensalPct: null,
    mesRecente: null,
    mesAnterior: null,
    categoriaQueMaisCresceu: null,
    comprometimentoDividasPct: null,
    totalMinimosDividas: 0,
  };

  const valid = transactions.filter(
    (t) =>
      (t.type === "receita" || t.type === "despesa") &&
      Number.isFinite(t.amount) &&
      t.amount > 0 &&
      typeof t.date === "string" &&
      t.date.length >= 7,
  );
  if (valid.length === 0) return empty;

  const despesas = valid.filter((t) => t.type === "despesa");
  const receitas = valid.filter((t) => t.type === "receita");
  const totalReceitas = receitas.reduce((s, t) => s + t.amount, 0);
  const totalDespesas = despesas.reduce((s, t) => s + t.amount, 0);

  // Totais por mês (despesas e receitas).
  const despPorMes = new Map<string, number>();
  const recPorMes = new Map<string, number>();
  for (const t of valid) {
    const k = monthKey(t.date);
    if (t.type === "despesa") despPorMes.set(k, (despPorMes.get(k) ?? 0) + t.amount);
    else recPorMes.set(k, (recPorMes.get(k) ?? 0) + t.amount);
  }
  const meses = [...new Set([...despPorMes.keys(), ...recPorMes.keys()])].sort();

  // Top categoria de gasto.
  const porCategoria = new Map<string, number>();
  for (const t of despesas) {
    porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + t.amount);
  }
  let topCategoria: string | null = null;
  let topCategoriaTotal = 0;
  for (const [cat, total] of [...porCategoria.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR"),
  )) {
    if (total > topCategoriaTotal) {
      topCategoria = cat;
      topCategoriaTotal = total;
    }
  }

  // Maior gasto individual.
  let maiorGasto: WhyFacts["maiorGasto"] = null;
  for (const t of despesas) {
    if (!maiorGasto || t.amount > maiorGasto.amount) {
      maiorGasto = { description: t.description, amount: t.amount, date: t.date };
    }
  }

  // Variação mensal (dois meses mais recentes com despesa).
  let variacaoMensalPct: number | null = null;
  let mesRecente: string | null = null;
  let mesAnterior: string | null = null;
  const mesesComDespesa = meses.filter((m) => (despPorMes.get(m) ?? 0) > 0);
  if (mesesComDespesa.length >= 2) {
    mesRecente = mesesComDespesa[mesesComDespesa.length - 1];
    mesAnterior = mesesComDespesa[mesesComDespesa.length - 2];
    const recente = despPorMes.get(mesRecente) ?? 0;
    const anterior = despPorMes.get(mesAnterior) ?? 0;
    if (anterior > 0) variacaoMensalPct = (recente - anterior) / anterior;
  }

  // Categoria que mais cresceu (mês recente vs. anterior, base > 0).
  let categoriaQueMaisCresceu: WhyFacts["categoriaQueMaisCresceu"] = null;
  if (mesRecente && mesAnterior) {
    const porCat = (mes: string) => {
      const m = new Map<string, number>();
      for (const t of despesas) {
        if (monthKey(t.date) === mes) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
      }
      return m;
    };
    const rec = porCat(mesRecente);
    const ant = porCat(mesAnterior);
    for (const [cat, totalRec] of [...rec.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR"),
    )) {
      const totalAnt = ant.get(cat) ?? 0;
      if (totalAnt > 0) {
        const crescimento = (totalRec - totalAnt) / totalAnt;
        if (!categoriaQueMaisCresceu || crescimento > categoriaQueMaisCresceu.crescimentoPct) {
          categoriaQueMaisCresceu = { categoria: cat, crescimentoPct: crescimento };
        }
      }
    }
  }

  // Comprometimento com dívidas: mínimos / receita média mensal.
  const totalMinimosDividas = debts.reduce(
    (s, d) => s + (Number.isFinite(d.minimumPayment) ? Math.max(0, d.minimumPayment) : 0),
    0,
  );
  let comprometimentoDividasPct: number | null = null;
  const mesesComReceita = meses.filter((m) => (recPorMes.get(m) ?? 0) > 0);
  if (totalMinimosDividas > 0 && mesesComReceita.length > 0) {
    const receitaMedia =
      mesesComReceita.reduce((s, m) => s + (recPorMes.get(m) ?? 0), 0) /
      mesesComReceita.length;
    if (receitaMedia > 0) comprometimentoDividasPct = totalMinimosDividas / receitaMedia;
  }

  return {
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    mesesAnalisados: meses.length,
    topCategoria,
    topCategoriaTotal,
    topCategoriaPct: totalDespesas > 0 ? topCategoriaTotal / totalDespesas : 0,
    maiorGasto,
    variacaoMensalPct,
    mesRecente,
    mesAnterior,
    categoriaQueMaisCresceu,
    comprometimentoDividasPct,
    totalMinimosDividas,
  };
}

function verbalize(facts: WhyFacts): WhySection[] {
  const sections: WhySection[] = [];

  // --- Seção 1: O que aconteceu ---
  const p1: string[] = [];
  p1.push(
    `No período analisado (${facts.mesesAnalisados} ${facts.mesesAnalisados === 1 ? "mês" : "meses"}), ` +
      `você registrou ${fmtMoney(facts.totalReceitas)} em receitas e ${fmtMoney(facts.totalDespesas)} em despesas, ` +
      `com saldo de ${fmtMoney(facts.saldo)}.`,
  );
  if (facts.topCategoria) {
    p1.push(
      `A categoria que mais pesou no bolso foi "${facts.topCategoria}", com ${fmtMoney(facts.topCategoriaTotal)} — ` +
        `isso representa ${fmtPct(facts.topCategoriaPct)} de tudo que você gastou.`,
    );
  }
  if (facts.maiorGasto) {
    p1.push(
      `O maior gasto individual foi "${facts.maiorGasto.description}", de ${fmtMoney(facts.maiorGasto.amount)} ` +
        `em ${facts.maiorGasto.date.split("-").reverse().join("/")}.`,
    );
  }
  sections.push({ title: "O que aconteceu", paragraphs: p1 });

  // --- Seção 2: Por que aconteceu ---
  const p2: string[] = [];
  if (facts.variacaoMensalPct !== null && facts.mesRecente && facts.mesAnterior) {
    const dir = facts.variacaoMensalPct >= 0 ? "aumentaram" : "diminuíram";
    p2.push(
      `Suas despesas ${dir} ${fmtPct(Math.abs(facts.variacaoMensalPct))} de ${monthLabelPtBR(facts.mesAnterior)} para ${monthLabelPtBR(facts.mesRecente)}.`,
    );
    if (facts.categoriaQueMaisCresceu && facts.categoriaQueMaisCresceu.crescimentoPct > 0) {
      p2.push(
        `A categoria que mais puxou esse movimento foi "${facts.categoriaQueMaisCresceu.categoria}", ` +
          `com crescimento de ${fmtPct(facts.categoriaQueMaisCresceu.crescimentoPct)} no período.`,
      );
    } else if (facts.topCategoria) {
      p2.push(
        `A concentração em "${facts.topCategoria}" (${fmtPct(facts.topCategoriaPct)} dos gastos) explica ` +
          `boa parte do comportamento do período.`,
      );
    }
  } else if (facts.topCategoria) {
    p2.push(
      `Com apenas um mês de dados, ainda não há variação mensal para comparar — mas a concentração em ` +
        `"${facts.topCategoria}" (${fmtPct(facts.topCategoriaPct)} dos gastos) já indica onde o dinheiro está indo.`,
    );
  } else {
    p2.push(
      `Ainda há poucos lançamentos para identificar padrões. Continue registrando: o "porquê" aparece ` +
        `quando há histórico para comparar.`,
    );
  }
  if (facts.comprometimentoDividasPct !== null) {
    p2.push(
      `Os pagamentos mínimos das suas dívidas somam ${fmtMoney(facts.totalMinimosDividas)} por mês, ` +
        `o equivalente a ${fmtPct(facts.comprometimentoDividasPct)} da sua receita média mensal.`,
    );
  }
  sections.push({ title: "Por que aconteceu", paragraphs: p2 });

  // --- Seção 3: O que você pode fazer ---
  const p3: string[] = [];
  if (facts.topCategoria && facts.topCategoriaPct >= 0.4) {
    p3.push(
      `Revise "${facts.topCategoria}": quando uma única categoria passa de 40% dos gastos, pequenos cortes ali ` +
        `têm o maior efeito no seu saldo.`,
    );
  }
  if (facts.variacaoMensalPct !== null && facts.variacaoMensalPct >= 0.2) {
    p3.push(
      `As despesas cresceram mais de 20% de um mês para o outro. Vale revisar os lançamentos do mês mais recente ` +
        `e separar o que foi pontual do que virou hábito.`,
    );
  }
  if (facts.saldo < 0) {
    p3.push(
      `O saldo do período está negativo (${fmtMoney(facts.saldo)}). Priorize cobrir o essencial e adie gastos ` +
        `não urgentes até o saldo se recuperar.`,
    );
  }
  if (facts.comprometimentoDividasPct !== null && facts.comprometimentoDividasPct >= 0.3) {
    p3.push(
      `Com ${fmtPct(facts.comprometimentoDividasPct)} da receita comprometida com mínimos de dívidas, considere usar o ` +
        `simulador da página Dívidas para comparar as estratégias avalanche e snowball.`,
    );
  }
  p3.push(
    `Continue registrando cada lançamento: quanto mais histórico, mais preciso fica o diagnóstico do próximo relatório.`,
  );
  sections.push({ title: "O que você pode fazer", paragraphs: p3 });

  return sections;
}

/**
 * Monta o Relatório Porquê a partir das transações (e dívidas opcionais).
 * Determinístico: mesmos dados de entrada => mesmo relatório.
 */
export function buildWhyReport(
  transactions: WhyTransaction[],
  debts: WhyDebt[] = [],
  nowISO?: string,
): WhyReport {
  const facts = computeFacts(transactions, debts);
  const hasData = facts.mesesAnalisados > 0;

  if (!hasData) {
    return {
      generatedAtISO: nowISO ?? new Date().toISOString(),
      hasData: false,
      facts,
      sections: [
        {
          title: "Sem dados ainda",
          paragraphs: [
            "Você ainda não registrou lançamentos. O Relatório Porquê é calculado a partir dos seus dados reais — " +
              "registre receitas e despesas na página Transações e volte aqui para ver o diagnóstico.",
          ],
        },
      ],
    };
  }

  return {
    generatedAtISO: nowISO ?? new Date().toISOString(),
    hasData: true,
    facts,
    sections: verbalize(facts),
  };
}
