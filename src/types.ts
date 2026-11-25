export type TransactionType = 'expense' | 'income';
export type AccountType = 'credit' | 'debit' | 'savings';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'es' | 'en';

export interface Expense {
  id: string;
  title: string;
  price: number;
  date: string; // ISO string
  category: string;
  type: TransactionType;
  categoryID: string;
  notes?: string;
  accountID?: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  creditLimit: number;
  initialBalance: number;
  cutDay: number;
  graceDays: number;
  createdAt: string;
  /** Fixed annual yield percentage for savings/investment accounts (e.g. 12.5 for 12.5% APR). */
  annualRate?: number;
  /** ISO date string when the savings/investment account started accruing daily yield. */
  investmentStartDate?: string;
}

export interface DailyYieldEntry {
  dateKey: string;
  date: Date;
  startingBalance: number;
  netTransactions: number;
  dailyYield: number;
  endingBalance: number;
  cumulativeYield: number;
  isProjected: boolean;
}

export interface SavingsSummary {
  principal: number;
  accumulatedYield: number;
  totalBalance: number;
  todayYield: number;
  projectedMonthlyYield: number;
  projectedYearlyYield: number;
  daysElapsed: number;
  dailyEntries: DailyYieldEntry[];
}

export interface CategoryDef {
  id: string;
  nameEs: string;
  nameEn: string;
  color: string;
  icon: string;
}

export const BUILT_IN_CATEGORIES: CategoryDef[] = [
  { id: 'builtin.food', nameEs: 'Comida', nameEn: 'Food', color: '#34C759', icon: 'ShoppingCart' },
  { id: 'builtin.eatingOut', nameEs: 'Comer fuera', nameEn: 'Eating Out', color: '#00C7BE', icon: 'Utensils' },
  { id: 'builtin.rent', nameEs: 'Renta', nameEn: 'Rent', color: '#AF52DE', icon: 'Home' },
  { id: 'builtin.shopping', nameEs: 'Compras', nameEn: 'Shopping', color: '#FF9500', icon: 'ShoppingBag' },
  { id: 'builtin.entertainment', nameEs: 'Entretenimiento', nameEn: 'Entertainment', color: '#FF2D55', icon: 'Tv' },
  { id: 'builtin.transportation', nameEs: 'Transporte', nameEn: 'Transportation', color: '#5856D6', icon: 'Car' },
  { id: 'builtin.utilities', nameEs: 'Servicios', nameEn: 'Utilities', color: '#FFCC00', icon: 'Zap' },
  { id: 'builtin.subscriptions', nameEs: 'Suscripciones', nameEn: 'Subscriptions', color: '#007AFF', icon: 'Repeat' },
  { id: 'builtin.healthcare', nameEs: 'Salud', nameEn: 'Healthcare', color: '#FF3B30', icon: 'Heart' },
  { id: 'builtin.education', nameEs: 'Educación', nameEn: 'Education', color: '#5AC8FA', icon: 'BookOpen' },
  { id: 'builtin.others', nameEs: 'Otros', nameEn: 'Others', color: '#8E8E93', icon: 'MoreHorizontal' },
];

export interface CurrencyDef {
  code: string;
  symbol: string;
  nameEs: string;
  nameEn: string;
}

export const AVAILABLE_CURRENCIES: CurrencyDef[] = [
  { code: 'MXN', symbol: '$', nameEs: 'Peso mexicano', nameEn: 'Mexican Peso' },
  { code: 'USD', symbol: '$', nameEs: 'Dólar estadounidense', nameEn: 'US Dollar' },
  { code: 'EUR', symbol: '€', nameEs: 'Euro', nameEn: 'Euro' },
  { code: 'GBP', symbol: '£', nameEs: 'Libra esterlina', nameEn: 'British Pound' },
  { code: 'CAD', symbol: 'C$', nameEs: 'Dólar canadiense', nameEn: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', nameEs: 'Yen japonés', nameEn: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', nameEs: 'Dólar australiano', nameEn: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', nameEs: 'Franco suizo', nameEn: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', nameEs: 'Yuan chino', nameEn: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', nameEs: 'Rupia india', nameEn: 'Indian Rupee' },
];

// --- Account Cut & Payment Date Calculations (1:1 with Account.swift) ---

function cutDateWithOffset(cutDay: number, monthOffset: number, ref: Date): Date {
  const year = ref.getFullYear();
  const month = ref.getMonth() + monthOffset;
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(cutDay, 1), lastDayOfTargetMonth);
  return new Date(year, month, clampedDay, 0, 0, 0, 0);
}

export function getLastCutDate(account: Account, now: Date = new Date()): Date {
  const thisMonth = cutDateWithOffset(account.cutDay, 0, now);
  if (thisMonth.getTime() <= now.getTime()) {
    return thisMonth;
  }
  return cutDateWithOffset(account.cutDay, -1, now);
}

export function getNextCutDate(account: Account, now: Date = new Date()): Date {
  const thisMonth = cutDateWithOffset(account.cutDay, 0, now);
  if (thisMonth.getTime() > now.getTime()) {
    return thisMonth;
  }
  return cutDateWithOffset(account.cutDay, 1, now);
}

export function getNextPaymentDate(account: Account, now: Date = new Date()): Date {
  const nextCut = getNextCutDate(account, now);
  const due = new Date(nextCut);
  due.setDate(due.getDate() + account.graceDays);
  return due;
}

export function getDaysUntilPayment(account: Account, now: Date = new Date()): number {
  const due = getNextPaymentDate(account, now);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((startDue.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

export function getCycleTransactionsConsumed(
  account: Account,
  expenses: Expense[],
  now: Date = new Date()
): number {
  if (account.type !== 'credit') return 0;
  const start = getLastCutDate(account, now).getTime();
  const end = getNextCutDate(account, now).getTime();
  const inCycle = expenses.filter((e) => {
    if (e.accountID !== account.id) return false;
    const t = new Date(e.date).getTime();
    return t >= start && t < end;
  });
  const spent = inCycle.filter((e) => e.type === 'expense').reduce((s, e) => s + e.price, 0);
  const payments = inCycle.filter((e) => e.type === 'income').reduce((s, e) => s + e.price, 0);
  return spent - payments;
}

export function getAccountConsumed(
  account: Account,
  expenses: Expense[],
  now: Date = new Date()
): number {
  if (account.type !== 'credit') return 0;
  return Math.max(0, account.initialBalance + getCycleTransactionsConsumed(account, expenses, now));
}

export function getAccountAvailableBalance(
  account: Account,
  expenses: Expense[],
  now: Date = new Date()
): number {
  return account.creditLimit - getAccountConsumed(account, expenses, now);
}

export function getAccountCurrentBalance(account: Account, expenses: Expense[]): number {
  if (account.type === 'credit') return 0;
  if (account.type === 'savings') {
    return getSavingsSummary(account, expenses).totalBalance;
  }
  const mine = expenses.filter((e) => e.accountID === account.id);
  const income = mine.filter((e) => e.type === 'income').reduce((s, e) => s + e.price, 0);
  const spent = mine.filter((e) => e.type === 'expense').reduce((s, e) => s + e.price, 0);
  return account.initialBalance + income - spent;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Calculates day-by-day compound yield for a savings/investment account
 * from its start date through today (plus a 7-day forward projection).
 */
export function getSavingsSummary(
  account: Account,
  expenses: Expense[],
  now: Date = new Date()
): SavingsSummary {
  const annualRate = Math.max(0, account.annualRate || 0);
  const dailyRate = annualRate / 100 / 365;

  const rawStart = account.investmentStartDate
    ? new Date(account.investmentStartDate)
    : new Date(account.createdAt || now);
  const startDay = new Date(rawStart.getFullYear(), rawStart.getMonth(), rawStart.getDate());
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Cap lookback to 365 days max for fast rendering
  const minStart = new Date(todayDay);
  minStart.setDate(minStart.getDate() - 365);
  const effectiveStart = startDay < minStart ? minStart : startDay > todayDay ? todayDay : startDay;

  // Map net transactions by YYYY-MM-DD for this account
  const txByDay: Record<string, number> = {};
  let txBeforeStart = 0;
  for (const e of expenses) {
    if (e.accountID !== account.id) continue;
    const ed = new Date(e.date);
    const edDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
    const delta = e.type === 'income' ? e.price : -e.price;
    if (edDay < effectiveStart) {
      txBeforeStart += delta;
    } else {
      const key = toDateKey(edDay);
      txByDay[key] = (txByDay[key] || 0) + delta;
    }
  }

  let runningBalance = Math.max(0, account.initialBalance + txBeforeStart);
  let principal = runningBalance;
  let cumulativeYield = 0;
  const entries: DailyYieldEntry[] = [];

  const totalDaysElapsed = Math.max(
    0,
    Math.round((todayDay.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Simulate each day from effectiveStart up to today + 7 projected days
  const futureDays = 7;
  for (let i = 0; i <= totalDaysElapsed + futureDays; i++) {
    const curDate = new Date(effectiveStart);
    curDate.setDate(curDate.getDate() + i);
    const key = toDateKey(curDate);
    const isProjected = i > totalDaysElapsed;
    const netTx = isProjected ? 0 : txByDay[key] || 0;

    const startBal = Math.max(0, runningBalance + netTx);
    if (!isProjected) {
      principal = Math.max(0, principal + netTx);
    }

    // Day 0 is the deposit day; if startDay == todayDay, show 1 day's daily yield rate preview
    const yieldForDay = startBal * dailyRate;
    const endBal = startBal + yieldForDay;
    cumulativeYield += yieldForDay;
    runningBalance = endBal;

    entries.push({
      dateKey: key,
      date: curDate,
      startingBalance: startBal,
      netTransactions: netTx,
      dailyYield: yieldForDay,
      endingBalance: endBal,
      cumulativeYield,
      isProjected,
    });
  }

  const todayEntry = entries[totalDaysElapsed] || entries[0];
  const currentTotalBalance = todayEntry ? todayEntry.endingBalance : principal;
  const currentAccumulatedYield = todayEntry ? todayEntry.cumulativeYield : 0;
  const todayYield = currentTotalBalance * dailyRate;

  // Compound projections from currentTotalBalance
  const projectedMonthlyYield =
    dailyRate > 0 ? currentTotalBalance * (Math.pow(1 + dailyRate, 30) - 1) : 0;
  const projectedYearlyYield =
    dailyRate > 0 ? currentTotalBalance * (Math.pow(1 + dailyRate, 365) - 1) : 0;

  return {
    principal,
    accumulatedYield: currentAccumulatedYield,
    totalBalance: currentTotalBalance,
    todayYield,
    projectedMonthlyYield,
    projectedYearlyYield,
    daysElapsed: totalDaysElapsed + 1,
    dailyEntries: entries,
  };
}
