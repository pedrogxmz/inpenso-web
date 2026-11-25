import {
  Account,
  BUILT_IN_CATEGORIES,
  Expense,
  getAccountAvailableBalance,
  getAccountConsumed,
  getAccountCurrentBalance,
  getDaysUntilPayment,
  getNextCutDate,
  getNextPaymentDate,
} from '../types';

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        foundationModels?: {
          postMessage: (payload: { id: string; prompt: string; context: string }) => void;
        };
      };
    };
    InpensoNative?: {
      isFoundationModelsAvailable?: () => boolean;
      onResponse?: (id: string, text: string, done: boolean, error?: string) => void;
    };
  }
}

export function hasNativeAppleIntelligenceBridge(): boolean {
  return Boolean(
    window.webkit?.messageHandlers?.foundationModels ||
      window.InpensoNative?.isFoundationModelsAvailable?.()
  );
}

export function buildFinancialContext(
  expenses: Expense[],
  accounts: Account[],
  budgets: Record<string, number>,
  currency: string
): string {
  const now = new Date();
  const monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const monthlyBudget = budgets[monthKey] || 0;

  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalSpent = monthExpenses
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + e.price, 0);
  const totalIncome = monthExpenses
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + e.price, 0);

  const byCat: Record<string, number> = {};
  for (const e of monthExpenses.filter((x) => x.type === 'expense')) {
    const cat =
      BUILT_IN_CATEGORIES.find((c) => c.id === e.categoryID)?.nameEs || e.category || 'Otros';
    byCat[cat] = (byCat[cat] || 0) + e.price;
  }

  const catLines = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => `- ${name}: ${amount.toFixed(2)} ${currency}`)
    .join('\n');

  const accountLines = accounts
    .map((acc) => {
      if (acc.type === 'credit') {
        const consumed = getAccountConsumed(acc, expenses, now);
        const avail = getAccountAvailableBalance(acc, expenses, now);
        const due = getNextPaymentDate(acc, now).toLocaleDateString('es-MX');
        return `- ${acc.name} (Crédito): Límite ${acc.creditLimit.toFixed(2)}, Consumido ${consumed.toFixed(2)}, Disponible ${avail.toFixed(2)}, Pago ${due}`;
      }
      const bal = getAccountCurrentBalance(acc, expenses);
      return `- ${acc.name} (Débito): Saldo ${bal.toFixed(2)} ${currency}`;
    })
    .join('\n');

  return [
    `Moneda: ${currency}`,
    `Mes actual (${monthKey}): Gasto=${totalSpent.toFixed(2)}, Ingreso=${totalIncome.toFixed(2)}, Presupuesto=${monthlyBudget.toFixed(2)}`,
    `Categorías del mes:\n${catLines || '(sin gastos)'}`,
    `Cuentas:\n${accountLines || '(sin cuentas)'}`,
  ].join('\n\n');
}

export async function askAssistant(params: {
  prompt: string;
  expenses: Expense[];
  accounts: Account[];
  budgets: Record<string, number>;
  currency: string;
  apiKey?: string;
}): Promise<{ text: string; source: 'apple-intelligence' | 'cloud-api' | 'local-engine' }> {
  const { prompt, expenses, accounts, budgets, currency, apiKey } = params;
  const context = buildFinancialContext(expenses, accounts, budgets, currency);

  // 1. Si corre dentro del contenedor .ipa con puente a FoundationModels (Apple Intelligence en chip)
  if (window.webkit?.messageHandlers?.foundationModels) {
    const text = await new Promise<string>((resolve, reject) => {
      const reqId = crypto.randomUUID();
      window.InpensoNative = window.InpensoNative || {};
      window.InpensoNative.onResponse = (id, responseText, done, error) => {
        if (id !== reqId) return;
        if (error) reject(new Error(error));
        else if (done) resolve(responseText);
      };
      window.webkit!.messageHandlers!.foundationModels!.postMessage({
        id: reqId,
        prompt,
        context,
      });
    });
    return { text, source: 'apple-intelligence' };
  }

  // 2. Si el usuario configuró una API key opcional en Safari (OpenAI / OpenCode compatible)
  if (apiKey && apiKey.trim().length > 8) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres el asistente financiero de Inpenso. Responde en español de forma concisa y útil usando estos datos reales del usuario:\n${context}`,
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return { text: reply, source: 'cloud-api' };
      }
    } catch {
      // Fallback al motor local si falla la red
    }
  }

  // 3. Motor financiero local en el navegador (100% offline en Safari, sin enviar datos)
  return {
    text: answerWithLocalEngine(prompt, expenses, accounts, budgets, currency),
    source: 'local-engine',
  };
}

function answerWithLocalEngine(
  prompt: string,
  expenses: Expense[],
  accounts: Account[],
  budgets: Record<string, number>,
  currency: string
): string {
  const q = prompt.toLowerCase();
  const now = new Date();
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n);

  const monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const budget = budgets[monthKey] || 0;

  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const spent = monthExpenses.filter((e) => e.type === 'expense').reduce((s, e) => s + e.price, 0);
  const income = monthExpenses.filter((e) => e.type === 'income').reduce((s, e) => s + e.price, 0);

  const byCat: Record<string, number> = {};
  for (const e of monthExpenses.filter((x) => x.type === 'expense')) {
    const cat =
      BUILT_IN_CATEGORIES.find((c) => c.id === e.categoryID)?.nameEs || e.category || 'Otros';
    byCat[cat] = (byCat[cat] || 0) + e.price;
  }
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  if (q.includes('cuenta') || q.includes('tarjeta') || q.includes('crédito') || q.includes('corte') || q.includes('pago')) {
    if (accounts.length === 0) {
      return 'Aún no tienes cuentas registradas. Ve a la pestaña **Cuentas** y toca **+ Nueva** para registrar tus tarjetas de crédito o débito.';
    }
    const lines = accounts.map((acc) => {
      if (acc.type === 'credit') {
        const consumed = getAccountConsumed(acc, expenses, now);
        const avail = getAccountAvailableBalance(acc, expenses, now);
        const nextCut = getNextCutDate(acc, now).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        const due = getNextPaymentDate(acc, now).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        const days = getDaysUntilPayment(acc, now);
        return `• **${acc.name}** (Crédito): Disponible **${fmt(avail)}** de ${fmt(acc.creditLimit)} (consumido ${fmt(consumed)}). Próximo corte: ${nextCut} | Fecha de pago: **${due}** (en ${days} días).`;
      }
      return `• **${acc.name}** (Débito): Saldo actual **${fmt(getAccountCurrentBalance(acc, expenses))}**.`;
    });
    return `Aquí tienes el estado actual de tus cuentas:\n\n${lines.join('\n')}`;
  }

  if (q.includes('categor') || q.includes('más grande') || q.includes('mayor')) {
    if (sortedCats.length === 0) {
      return 'Este mes todavía no tienes gastos registrados por categoría.';
    }
    const [topName, topVal] = sortedCats[0];
    const pct = spent > 0 ? Math.round((topVal / spent) * 100) : 0;
    const list = sortedCats
      .slice(0, 4)
      .map(([name, val], idx) => `${idx + 1}. **${name}**: ${fmt(val)} (${Math.round((val / Math.max(spent, 1)) * 100)}%)`)
      .join('\n');
    return `Tu categoría con mayor gasto este mes es **${topName}** con **${fmt(topVal)}** (${pct}% del total).\n\nPrincipales categorías:\n${list}`;
  }

  if (q.includes('presupuesto') || q.includes('voy bien')) {
    if (budget <= 0) {
      return `Este mes llevas gastados **${fmt(spent)}**, pero aún no has definido un presupuesto mensual. Puedes configurarlo en **Analíticas → Presupuesto**.`;
    }
    const pct = Math.round((spent / budget) * 100);
    const remaining = budget - spent;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - now.getDate());
    const dailyAllowance = Math.max(0, remaining / daysLeft);

    if (remaining >= 0) {
      return `Has usado el **${pct}%** de tu presupuesto (${fmt(spent)} de ${fmt(budget)}). Te quedan **${fmt(remaining)}** disponibles, es decir, puedes gastar hasta **${fmt(dailyAllowance)} por día** durante los próximos ${daysLeft} días.`;
    }
    return `Atención: has superado tu presupuesto mensual de ${fmt(budget)} por **${fmt(Math.abs(remaining))}** (${pct}% usado).`;
  }

  if (q.includes('consejo') || q.includes('ahorr') || q.includes('tip')) {
    const topTip =
      sortedCats.length > 0
        ? `1. **Reduce un 15% en ${sortedCats[0][0]}**: Es tu mayor gasto del mes (${fmt(sortedCats[0][1])}); recortar un 15% te ahorraría **${fmt(sortedCats[0][1] * 0.15)}**.`
        : '1. **Registra todos tus gastos diarios**: Asignar cada compra a su categoría te permite detectar gastos hormiga.';
    const creditAccounts = accounts.filter((a) => a.type === 'credit');
    const cardTip =
      creditAccounts.length > 0
        ? `2. **Cuida tus fechas de pago**: Tienes ${creditAccounts.length} tarjeta(s) de crédito registrada(s); pagar antes de la fecha límite evita intereses.`
        : '2. **Registra tus tarjetas de crédito**: En la pestaña Cuentas puedes vigilar tu saldo libre y fechas de corte.';
    const budgetTip =
      budget > 0
        ? `3. **Mantén tu límite diario**: Para cumplir tu presupuesto de ${fmt(budget)}, procura no exceder el presupuesto diario restante.`
        : '3. **Define un presupuesto mensual**: Ve a Analíticas → Presupuesto para fijar una meta mensual.';
    return `Aquí tienes 3 recomendaciones basadas en tus datos actuales:\n\n${topTip}\n${cardTip}\n${budgetTip}`;
  }

  // Respuesta general de gasto del mes
  const topSummary =
    sortedCats.length > 0
      ? ` Tu principal categoría es **${sortedCats[0][0]}** (${fmt(sortedCats[0][1])}).`
      : '';
  const budgetSummary =
    budget > 0
      ? ` Llevas el **${Math.round((spent / budget) * 100)}%** de tu presupuesto de ${fmt(budget)}.`
      : '';
  return `Este mes llevas gastados **${fmt(spent)}** y has registrado ingresos por **${fmt(income)}** (flujo neto: **${fmt(income - spent)}**).${topSummary}${budgetSummary}`;
}
