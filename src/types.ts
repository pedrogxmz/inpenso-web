export type TransactionType = 'expense' | 'income';
export type AccountType = 'credit' | 'debit';
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
  if (account.type !== 'debit') return 0;
  const mine = expenses.filter((e) => e.accountID === account.id);
  const income = mine.filter((e) => e.type === 'income').reduce((s, e) => s + e.price, 0);
  const spent = mine.filter((e) => e.type === 'expense').reduce((s, e) => s + e.price, 0);
  return account.initialBalance + income - spent;
}
