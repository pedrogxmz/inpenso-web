import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Heart,
  Home,
  List,
  MoreHorizontal,
  PieChart,
  Plus,
  Repeat,
  Search,
  Send,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrendingUp,
  Tv,
  Upload,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import {
  Account,
  AccountType,
  AVAILABLE_CURRENCIES,
  BUILT_IN_CATEGORIES,
  CategoryDef,
  Expense,
  getAccountAvailableBalance,
  getAccountConsumed,
  getAccountCurrentBalance,
  getCycleTransactionsConsumed,
  getDaysUntilPayment,
  getNextCutDate,
  getNextPaymentDate,
  getSavingsSummary,
  ThemeMode,
  TransactionType,
} from './types';
import { askAssistant, hasNativeAppleIntelligenceBridge } from './bridge/appleIntelligence';

type MainTab = 'home' | 'analytics' | 'transactions' | 'accounts' | 'settings';
type AnalyticsSubTab = 'overview' | 'trends' | 'insights' | 'budget';

const STORAGE_KEYS = {
  EXPENSES: 'inpenso_expenses',
  ACCOUNTS: 'inpenso_accounts',
  BUDGETS: 'inpenso_budgets',
  CURRENCY: 'inpenso_currency',
  THEME: 'inpenso_theme',
  DEFAULT_CAT: 'inpenso_default_category',
  API_KEY: 'inpenso_api_key',
};

function renderCategoryIcon(iconName: string, className = 'w-5 h-5') {
  switch (iconName) {
    case 'ShoppingCart':
      return <ShoppingCart className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'Home':
      return <Home className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Tv':
      return <Tv className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Repeat':
      return <Repeat className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}

export default function App() {
  // --- Persistent State ---
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [currency, setCurrency] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.CURRENCY) || 'MXN'
  );
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode) || 'system'
  );
  const [defaultCategoryID, setDefaultCategoryID] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.DEFAULT_CAT) || 'builtin.food'
  );
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
  );

  // --- Navigation & Modals ---
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsSubTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Transaction Modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Expense | null>(null);

  // Account Modal
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Assistant Modal
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Persist changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_CAT, defaultCategoryID);
  }, [defaultCategoryID]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', isDark ? '#000000' : '#F2F2F7');
      }
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  const fmt = (value: number) => {
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toFixed(2)} ${currency}`;
    }
  };

  const getCategory = (categoryID: string): CategoryDef =>
    BUILT_IN_CATEGORIES.find((c) => c.id === categoryID) ||
    BUILT_IN_CATEGORIES[BUILT_IN_CATEGORIES.length - 1];

  const getAccount = (accountID?: string): Account | undefined =>
    accounts.find((a) => a.id === accountID);

  // --- Computed Metrics for Selected Month/Year ---
  const monthKey = `${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
  const currentBudget = budgets[monthKey] || 0;

  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [expenses, selectedMonth, selectedYear]);

  const prevMonthExpenses = useMemo(() => {
    const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === prevDate.getMonth() && d.getFullYear() === prevDate.getFullYear();
    });
  }, [expenses, selectedMonth, selectedYear]);

  const totalSpent = useMemo(
    () => monthExpenses.filter((e) => e.type === 'expense').reduce((s, e) => s + e.price, 0),
    [monthExpenses]
  );

  const totalIncome = useMemo(
    () => monthExpenses.filter((e) => e.type === 'income').reduce((s, e) => s + e.price, 0),
    [monthExpenses]
  );

  const netCashflow = totalIncome - totalSpent;

  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const now = new Date();
  const isCurrentMonth =
    now.getMonth() === selectedMonth && now.getFullYear() === selectedYear;
  const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : daysInSelectedMonth;
  const daysRemaining = isCurrentMonth
    ? Math.max(0, daysInSelectedMonth - now.getDate())
    : 0;
  const averageDailySpend = totalSpent / elapsedDays;
  const projectedMonthlySpend = isCurrentMonth
    ? totalSpent + averageDailySpend * daysRemaining
    : totalSpent;

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of monthExpenses.filter((x) => x.type === 'expense')) {
      map[e.categoryID] = (map[e.categoryID] || 0) + e.price;
    }
    return Object.entries(map)
      .map(([catId, amount]) => ({
        category: getCategory(catId),
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, totalSpent]);

  // --- Handlers ---
  const openAddTransaction = () => {
    setEditingTx(null);
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: Expense) => {
    setEditingTx(tx);
    setTxModalOpen(true);
  };

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccModalOpen(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccModalOpen(true);
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#F2F2F7] dark:bg-black text-gray-900 dark:text-gray-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar (visible on md and larger screens) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col justify-between bg-white dark:bg-zinc-900 border-r border-gray-200/80 dark:border-zinc-800 p-5 h-dvh">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <img src="./icon.svg" alt="Inpenso" className="w-10 h-10 rounded-xl shadow-sm" />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Inpenso</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Finanzas personales</p>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={openAddTransaction}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva transacción</span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="space-y-1">
            <SidebarButton
              active={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
              icon={<Home className="w-5 h-5" />}
              label="Inicio"
            />
            <SidebarButton
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              icon={<PieChart className="w-5 h-5" />}
              label="Analíticas"
            />
            <SidebarButton
              active={activeTab === 'transactions'}
              onClick={() => setActiveTab('transactions')}
              icon={<List className="w-5 h-5" />}
              label="Transacciones"
            />
            <SidebarButton
              active={activeTab === 'accounts'}
              onClick={() => setActiveTab('accounts')}
              icon={<CreditCard className="w-5 h-5" />}
              label="Cuentas"
            />
            <SidebarButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-5 h-5" />}
              label="Ajustes"
            />
          </nav>
        </div>

        {/* Desktop Sidebar Footer Summary */}
        <div className="bg-gray-50 dark:bg-zinc-800/70 rounded-2xl p-3.5 space-y-1.5 text-xs">
          <p className="text-gray-500 dark:text-zinc-400 font-medium">Gasto del mes actual</p>
          <p className="text-lg font-bold">{fmt(totalSpent)}</p>
          {currentBudget > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              {Math.min(100, Math.round((totalSpent / currentBudget) * 100))}% del presupuesto (
              {fmt(currentBudget)})
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area (Mobile column on small screens, full wide dashboard on desktop) */}
      <div className="flex-1 flex flex-col w-full max-w-md md:max-w-6xl mx-auto relative h-dvh overflow-hidden">
        {/* Top Header */}
        <header className="safe-top shrink-0 z-20 bg-[#F2F2F7] dark:bg-black px-4 md:px-8 pb-2.5 md:pb-4 flex items-center justify-between border-b border-gray-200/60 dark:border-zinc-800/70">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {activeTab === 'home' && 'Inicio'}
            {activeTab === 'analytics' && 'Analíticas'}
            {activeTab === 'transactions' && 'Transacciones'}
            {activeTab === 'accounts' && 'Cuentas'}
            {activeTab === 'settings' && 'Ajustes'}
          </h1>

          <div className="flex items-center gap-2">
            {(activeTab === 'home' || activeTab === 'transactions') && (
              <button
                onClick={openAddTransaction}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            )}

            {activeTab === 'accounts' && (
              <button
                onClick={openNewAccount}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva cuenta</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pt-3 md:pt-6 pb-28 md:pb-10 space-y-4">
        {activeTab === 'home' && (
          <HomeTab
            expenses={expenses}
            monthExpenses={monthExpenses}
            totalSpent={totalSpent}
            totalIncome={totalIncome}
            netCashflow={netCashflow}
            currentBudget={currentBudget}
            daysRemaining={daysRemaining}
            categoryBreakdown={categoryBreakdown}
            fmt={fmt}
            getCategory={getCategory}
            getAccount={getAccount}
            onEditTx={openEditTransaction}
            onViewAllTx={() => setActiveTab('transactions')}
            onAddTx={openAddTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTabView
            analyticsTab={analyticsTab}
            setAnalyticsTab={setAnalyticsTab}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            monthExpenses={monthExpenses}
            prevMonthExpenses={prevMonthExpenses}
            totalSpent={totalSpent}
            totalIncome={totalIncome}
            netCashflow={netCashflow}
            averageDailySpend={averageDailySpend}
            projectedMonthlySpend={projectedMonthlySpend}
            daysRemaining={daysRemaining}
            daysInSelectedMonth={daysInSelectedMonth}
            currentBudget={currentBudget}
            onSaveBudget={(val) =>
              setBudgets((prev) => ({
                ...prev,
                [monthKey]: val,
              }))
            }
            categoryBreakdown={categoryBreakdown}
            fmt={fmt}
            getCategory={getCategory}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTab
            expenses={expenses}
            fmt={fmt}
            getCategory={getCategory}
            getAccount={getAccount}
            onEditTx={openEditTransaction}
            onAddTx={openAddTransaction}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsTab
            accounts={accounts}
            expenses={expenses}
            fmt={fmt}
            onNewAccount={openNewAccount}
            onEditAccount={openEditAccount}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            currency={currency}
            setCurrency={setCurrency}
            theme={theme}
            setTheme={setTheme}
            defaultCategoryID={defaultCategoryID}
            setDefaultCategoryID={setDefaultCategoryID}
            expenses={expenses}
            accounts={accounts}
            budgets={budgets}
            onImportData={(data) => {
              if (Array.isArray(data.expenses)) setExpenses(data.expenses);
              if (Array.isArray(data.accounts)) setAccounts(data.accounts);
              if (data.budgets && typeof data.budgets === 'object') setBudgets(data.budgets);
            }}
            onResetAll={() => {
              setExpenses([]);
              setAccounts([]);
              setBudgets({});
            }}
          />
        )}
      </main>

      {/* Floating Assistant Button on Home (only shown inside native .ipa with Apple Intelligence bridge) */}
      {activeTab === 'home' && hasNativeAppleIntelligenceBridge() && (
        <button
          onClick={() => setAssistantOpen(true)}
          aria-label="Asistente"
          className="fixed bottom-22 right-5 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/35 flex items-center justify-center active:scale-95 transition"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

        {/* iOS Bottom Tab Bar (hidden on desktop md+) */}
        <nav className="md:hidden safe-bottom fixed bottom-0 left-0 right-0 z-20 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border-t border-gray-200/80 dark:border-zinc-800">
          <div className="max-w-md mx-auto grid grid-cols-5 pt-1.5 pb-1">
            <TabButton
              active={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
              icon={<Home className="w-5 h-5" />}
              label="Inicio"
            />
            <TabButton
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              icon={<PieChart className="w-5 h-5" />}
              label="Analíticas"
            />
            <TabButton
              active={activeTab === 'transactions'}
              onClick={() => setActiveTab('transactions')}
              icon={<List className="w-5 h-5" />}
              label="Gastos"
            />
            <TabButton
              active={activeTab === 'accounts'}
              onClick={() => setActiveTab('accounts')}
              icon={<CreditCard className="w-5 h-5" />}
              label="Cuentas"
            />
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-5 h-5" />}
              label="Ajustes"
            />
          </div>
        </nav>
      </div>

      {/* Transaction Add / Edit Modal */}
      {txModalOpen && (
        <TransactionModal
          initialTx={editingTx}
          defaultCategoryID={defaultCategoryID}
          accounts={accounts}
          currency={currency}
          onClose={() => setTxModalOpen(false)}
          onSave={(tx) => {
            setExpenses((prev) => {
              const exists = prev.some((x) => x.id === tx.id);
              return exists ? prev.map((x) => (x.id === tx.id ? tx : x)) : [tx, ...prev];
            });
            setTxModalOpen(false);
          }}
          onDelete={(id) => {
            setExpenses((prev) => prev.filter((x) => x.id !== id));
            setTxModalOpen(false);
          }}
          onQuickCreateAccount={(newAcc) => {
            setAccounts((prev) => [...prev, newAcc]);
          }}
        />
      )}

      {/* Account Add / Edit Modal */}
      {accModalOpen && (
        <AccountModal
          initialAccount={editingAccount}
          expenses={expenses}
          currency={currency}
          fmt={fmt}
          onClose={() => setAccModalOpen(false)}
          onSave={(acc) => {
            setAccounts((prev) => {
              const exists = prev.some((x) => x.id === acc.id);
              return exists ? prev.map((x) => (x.id === acc.id ? acc : x)) : [...prev, acc];
            });
            setAccModalOpen(false);
          }}
          onDelete={(id) => {
            setAccounts((prev) => prev.filter((x) => x.id !== id));
            setAccModalOpen(false);
          }}
        />
      )}

      {/* Assistant Modal */}
      {assistantOpen && (
        <AssistantModal
          expenses={expenses}
          accounts={accounts}
          budgets={budgets}
          currency={currency}
          apiKey={apiKey}
          setApiKey={setApiKey}
          onClose={() => setAssistantOpen(false)}
        />
      )}
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
        active
          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-1 transition ${
        active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-zinc-500'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ============================================================================
// 1. HOME TAB
// ============================================================================
function HomeTab({
  expenses,
  totalSpent,
  totalIncome,
  netCashflow,
  currentBudget,
  daysRemaining,
  categoryBreakdown,
  fmt,
  getCategory,
  getAccount,
  onEditTx,
  onViewAllTx,
  onAddTx,
}: {
  expenses: Expense[];
  monthExpenses: Expense[];
  totalSpent: number;
  totalIncome: number;
  netCashflow: number;
  currentBudget: number;
  daysRemaining: number;
  categoryBreakdown: { category: CategoryDef; amount: number; percentage: number }[];
  fmt: (v: number) => string;
  getCategory: (id: string) => CategoryDef;
  getAccount: (id?: string) => Account | undefined;
  onEditTx: (e: Expense) => void;
  onViewAllTx: () => void;
  onAddTx: () => void;
}) {
  const budgetPct = currentBudget > 0 ? Math.min(100, Math.round((totalSpent / currentBudget) * 100)) : 0;

  // Last 7 days spending
  const recent7Days = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const sum = expenses
        .filter((e) => {
          if (e.type !== 'expense') return false;
          const ed = new Date(e.date);
          return (
            ed.getDate() === d.getDate() &&
            ed.getMonth() === d.getMonth() &&
            ed.getFullYear() === d.getFullYear()
          );
        })
        .reduce((s, e) => s + e.price, 0);
      days.push({
        label: d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 2),
        amount: sum,
      });
    }
    return days;
  }, [expenses]);

  const maxDayAmount = Math.max(...recent7Days.map((d) => d.amount), 1);

  const recentTransactions = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [expenses]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
      {/* Monthly Cashflow Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
              Flujo de caja mensual
            </p>
            <p className="text-3xl font-bold tracking-tight mt-0.5">{fmt(totalSpent)}</p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800 text-center">
          <div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Ingresos</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {fmt(totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Gastado</p>
            <p className="text-sm font-semibold">{fmt(totalSpent)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">Neto</p>
            <p
              className={`text-sm font-semibold ${
                netCashflow >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              {fmt(netCashflow)}
            </p>
          </div>
        </div>

        {currentBudget > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-zinc-400">
                Presupuesto: {fmt(currentBudget)}
              </span>
              <span className="font-semibold">{budgetPct}% usado</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 90
                    ? 'bg-red-500'
                    : budgetPct >= 75
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-zinc-400">
              <span>Restante: {fmt(Math.max(0, currentBudget - totalSpent))}</span>
              <span>quedan {daysRemaining} días</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent 7-day Spending Chart */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Gastos recientes</h2>
          <span className="text-xs text-gray-500 dark:text-zinc-400">Últimos 7 días</span>
        </div>
        <div className="grid grid-cols-7 gap-2 items-end h-28 pt-4">
          {recent7Days.map((d, i) => {
            const heightPct = Math.max(8, Math.round((d.amount / maxDayAmount) * 100));
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="w-full flex items-end justify-center h-20">
                  <div
                    className={`w-6 rounded-t-md transition-all ${
                      d.amount > 0
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-200 dark:bg-zinc-800'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 dark:text-zinc-400 capitalize">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      </div>

      <div className="space-y-4">
      {/* Category Breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold">Gasto por categoría</h2>
        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400 py-3 text-center">
            No hay datos de categorías disponibles este mes
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.slice(0, 4).map(({ category, amount, percentage }) => (
              <div key={category.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      {renderCategoryIcon(category.icon, 'w-3.5 h-3.5')}
                    </span>
                    <span className="font-medium">{category.nameEs}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{fmt(amount)}</span>
                    <span className="text-gray-400 ml-1.5">({Math.round(percentage)}%)</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, percentage)}%`,
                      backgroundColor: category.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transacciones recientes</h2>
          {expenses.length > 0 && (
            <button
              onClick={onViewAllTx}
              className="text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              Ver todas
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-gray-500 dark:text-zinc-400">Aún no hay transacciones</p>
            <button
              onClick={onAddTx}
              className="text-xs font-semibold text-white bg-blue-600 px-4 py-2 rounded-full"
            >
              Agregar un gasto
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {recentTransactions.map((tx) => {
              const cat = getCategory(tx.categoryID);
              const acc = getAccount(tx.accountID);
              return (
                <button
                  key={tx.id}
                  onClick={() => onEditTx(tx)}
                  className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{tx.title}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                        {cat.nameEs}
                        {acc ? ` • ${acc.name}` : ''} •{' '}
                        {new Date(tx.date).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold shrink-0 ml-2 ${
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {fmt(tx.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. ANALYTICS TAB (Resumen, Tendencias, Análisis inteligente, Presupuesto)
// ============================================================================
function AnalyticsTabView({
  analyticsTab,
  setAnalyticsTab,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  monthExpenses,
  prevMonthExpenses,
  totalSpent,
  totalIncome,
  netCashflow,
  averageDailySpend,
  projectedMonthlySpend,
  daysRemaining,
  daysInSelectedMonth,
  currentBudget,
  onSaveBudget,
  categoryBreakdown,
  fmt,
  getCategory,
}: {
  analyticsTab: AnalyticsSubTab;
  setAnalyticsTab: (t: AnalyticsSubTab) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  monthExpenses: Expense[];
  prevMonthExpenses: Expense[];
  totalSpent: number;
  totalIncome: number;
  netCashflow: number;
  averageDailySpend: number;
  projectedMonthlySpend: number;
  daysRemaining: number;
  daysInSelectedMonth: number;
  currentBudget: number;
  onSaveBudget: (val: number) => void;
  categoryBreakdown: { category: CategoryDef; amount: number; percentage: number }[];
  fmt: (v: number) => string;
  getCategory: (id: string) => CategoryDef;
}) {
  const [budgetInput, setBudgetInput] = useState(
    currentBudget > 0 ? String(currentBudget) : ''
  );

  useEffect(() => {
    setBudgetInput(currentBudget > 0 ? String(currentBudget) : '');
  }, [currentBudget, selectedMonth, selectedYear]);

  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  // Deterministic Smart Insights (exact match with AnalyticsViewModel.swift)
  const smartInsights = useMemo(() => {
    const list: {
      title: string;
      description: string;
      tone: 'negative' | 'neutral' | 'positive';
    }[] = [];

    if (currentBudget > 0) {
      const pct = (totalSpent / currentBudget) * 100;
      if (pct >= 90) {
        list.push({
          title: 'Alerta de presupuesto',
          description: `Has usado ${Math.round(pct)}% de tu presupuesto mensual.`,
          tone: 'negative',
        });
      } else if (pct >= 75) {
        list.push({
          title: 'Aviso de presupuesto',
          description: `Has usado ${Math.round(pct)}% de tu presupuesto mensual.`,
          tone: 'neutral',
        });
      } else if (daysRemaining < 7 && pct < 60) {
        list.push({
          title: 'Bajo el presupuesto',
          description: '¡Buen trabajo! Estás bajo el presupuesto este mes.',
          tone: 'positive',
        });
      }
    }

    // Category changes vs previous month
    const curCat: Record<string, number> = {};
    const prevCat: Record<string, number> = {};
    for (const e of monthExpenses.filter((x) => x.type === 'expense')) {
      curCat[e.categoryID] = (curCat[e.categoryID] || 0) + e.price;
    }
    for (const e of prevMonthExpenses.filter((x) => x.type === 'expense')) {
      prevCat[e.categoryID] = (prevCat[e.categoryID] || 0) + e.price;
    }

    let fastestGrow: { catId: string; pct: number } | null = null;
    let bestReduce: { catId: string; pct: number } | null = null;

    for (const catId of Object.keys({ ...curCat, ...prevCat })) {
      const prev = prevCat[catId] || 0;
      const cur = curCat[catId] || 0;
      if (prev > 0) {
        const change = ((cur - prev) / prev) * 100;
        if (change > 30 && (!fastestGrow || change > fastestGrow.pct)) {
          fastestGrow = { catId, pct: change };
        }
        if (change < -20 && (!bestReduce || change < bestReduce.pct)) {
          bestReduce = { catId, pct: Math.abs(change) };
        }
      }
    }

    if (fastestGrow) {
      list.push({
        title: 'Aumento de gasto',
        description: `El gasto en ${getCategory(fastestGrow.catId).nameEs} aumentó ${Math.round(
          fastestGrow.pct
        )}% respecto al mes pasado.`,
        tone: 'negative',
      });
    }

    if (bestReduce) {
      list.push({
        title: 'Disminución de gasto',
        description: `Reduciste el gasto en ${getCategory(bestReduce.catId).nameEs} un ${Math.round(
          bestReduce.pct
        )}%.`,
        tone: 'positive',
      });
    }

    if (currentBudget > 0 && projectedMonthlySpend > currentBudget) {
      list.push({
        title: 'Gasto excedido proyectado',
        description: `A este ritmo, podrías exceder tu presupuesto en ${fmt(
          projectedMonthlySpend - currentBudget
        )}.`,
        tone: 'negative',
      });
    }

    return list;
  }, [
    currentBudget,
    totalSpent,
    daysRemaining,
    monthExpenses,
    prevMonthExpenses,
    projectedMonthlySpend,
    fmt,
    getCategory,
  ]);

  // Deterministic Weekday vs Weekend & Monthly Pattern
  const patterns = useMemo(() => {
    const expOnly = monthExpenses.filter((e) => e.type === 'expense');
    if (expOnly.length === 0) return null;

    const weekdayAmounts: number[] = [];
    const weekendAmounts: number[] = [];
    const earlyAmounts: number[] = [];
    const midAmounts: number[] = [];
    const lateAmounts: number[] = [];
    const byWeekdayName: Record<string, number[]> = {};

    for (const e of expOnly) {
      const d = new Date(e.date);
      const dayOfWeek = d.getDay();
      const dayName = d.toLocaleDateString('es-MX', { weekday: 'long' });
      byWeekdayName[dayName] = byWeekdayName[dayName] || [];
      byWeekdayName[dayName].push(e.price);

      if (dayOfWeek === 0 || dayOfWeek === 6) weekendAmounts.push(e.price);
      else weekdayAmounts.push(e.price);

      const dom = d.getDate();
      if (dom <= 10) earlyAmounts.push(e.price);
      else if (dom <= 20) midAmounts.push(e.price);
      else lateAmounts.push(e.price);
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const wdAvg = avg(weekdayAmounts);
    const weAvg = avg(weekendAmounts);
    const ratio = wdAvg > 0 ? weAvg / wdAvg : 1;

    let weekdayTitle = 'Gasto equilibrado';
    let weekdayDesc = 'Tu gasto es bastante consistente durante la semana';
    if (ratio > 1.5) {
      weekdayTitle = 'Gastador de fin de semana';
      weekdayDesc = `Gastas ${Math.round(ratio * 100)}% más los fines de semana que entre semana`;
    } else if (ratio > 1.1) {
      weekdayTitle = 'Gasto de fin de semana ligeramente mayor';
      weekdayDesc = 'Tu gasto de fin de semana es moderadamente mayor que entre semana';
    } else if (ratio < 0.7) {
      weekdayTitle = 'Enfocado entre semana';
      weekdayDesc = 'Gastas significativamente más entre semana que los fines de semana';
    }

    const earlyAvg = avg(earlyAmounts);
    const midAvg = avg(midAmounts);
    const lateAvg = avg(lateAmounts);
    const maxAvg = Math.max(earlyAvg, midAvg, lateAvg);

    let monthTitle = 'Constante durante el mes';
    let monthDesc = 'Tu gasto se distribuye de forma bastante pareja durante el mes';
    if (maxAvg === earlyAvg && earlyAvg > midAvg * 1.3 && earlyAvg > lateAvg * 1.3) {
      monthTitle = 'Gastador a inicios de mes';
      monthDesc = 'Tiendes a gastar más en la primera parte del mes';
    } else if (maxAvg === lateAvg && lateAvg > earlyAvg * 1.3 && lateAvg > midAvg * 1.3) {
      monthTitle = 'Gastador a fin de mes';
      monthDesc = 'Tu gasto aumenta hacia el final del mes';
    } else if (maxAvg === midAvg && midAvg > earlyAvg * 1.3 && midAvg > lateAvg * 1.3) {
      monthTitle = 'Pico a mediados de mes';
      monthDesc = 'Tu gasto alcanza su máximo a mediados del mes';
    }

    let topWeekday = '';
    let topWeekdayAvg = 0;
    for (const [name, vals] of Object.entries(byWeekdayName)) {
      const a = avg(vals);
      if (a > topWeekdayAvg) {
        topWeekdayAvg = a;
        topWeekday = name;
      }
    }

    return {
      weekdayTitle,
      weekdayDesc,
      monthTitle,
      monthDesc,
      topWeekday,
    };
  }, [monthExpenses]);

  return (
    <div className="space-y-4">
      {/* Month / Year Picker */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="bg-transparent font-semibold text-sm focus:outline-none"
        >
          {months.map((m, idx) => (
            <option key={m} value={idx} className="text-black">
              {m}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-transparent font-semibold text-sm focus:outline-none"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y} className="text-black">
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Segmented Sub-tabs */}
      <div className="grid grid-cols-4 bg-gray-200/80 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
        {(
          [
            ['overview', 'Resumen'],
            ['trends', 'Tendencias'],
            ['insights', 'Análisis'],
            ['budget', 'Presupuesto'],
          ] as [AnalyticsSubTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAnalyticsTab(id)}
            className={`py-1.5 rounded-lg transition ${
              analyticsTab === id
                ? 'bg-white dark:bg-zinc-900 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab 1: Overview */}
      {analyticsTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard title="Gasto total" value={fmt(totalSpent)} color="text-blue-600" />
            <MetricCard title="Ingresos" value={fmt(totalIncome)} color="text-emerald-600" />
            <MetricCard
              title="Neto"
              value={fmt(netCashflow)}
              color={netCashflow >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricCard
              title="Promedio diario"
              value={fmt(averageDailySpend)}
              color="text-purple-600"
            />
            <MetricCard
              title="Presupuesto usado"
              value={
                currentBudget > 0
                  ? `${Math.min(100, Math.round((totalSpent / currentBudget) * 100))}%`
                  : 'Sin definir'
              }
              color="text-amber-500"
            />
            <MetricCard
              title="Días restantes"
              value={`${daysRemaining} días`}
              color="text-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Gasto por categoría</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No hay datos disponibles</p>
            ) : (
              categoryBreakdown.map(({ category, amount, percentage }) => (
                <div key={category.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.nameEs}</span>
                  </div>
                  <span className="font-semibold">
                    {fmt(amount)} ({Math.round(percentage)}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Trends */}
      {analyticsTab === 'trends' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold">Gasto diario del mes</h3>
          <div className="flex items-end gap-1 h-32 pt-4 overflow-x-auto">
            {Array.from({ length: daysInSelectedMonth }, (_, idx) => {
              const dayNum = idx + 1;
              const sum = monthExpenses
                .filter((e) => e.type === 'expense' && new Date(e.date).getDate() === dayNum)
                .reduce((s, e) => s + e.price, 0);
              const max = Math.max(totalSpent * 0.25, 1);
              const h = sum > 0 ? Math.max(12, Math.min(100, Math.round((sum / max) * 100))) : 4;
              return (
                <div key={dayNum} className="flex flex-col items-center flex-1 min-w-[8px] h-full justify-end">
                  <div
                    className={`w-full rounded-t ${
                      sum > 0 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'
                    }`}
                    style={{ height: `${h}%` }}
                    title={`Día ${dayNum}: ${fmt(sum)}`}
                  />
                  {dayNum % 5 === 1 && (
                    <span className="text-[9px] text-gray-400 mt-1">{dayNum}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Smart Insights */}
      {analyticsTab === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Key Statistics */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Estadísticas clave</h3>
            {categoryBreakdown.length > 0 ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                <div>
                  <p className="text-xs text-gray-500">Categoría con mayor gasto</p>
                  <p className="text-base font-bold mt-0.5">
                    {categoryBreakdown[0].category.nameEs}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {Math.round(categoryBreakdown[0].percentage)}% del total
                  </p>
                  <p className="text-base font-bold">{fmt(categoryBreakdown[0].amount)}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Aún no hay suficientes datos</p>
            )}

            {patterns?.topWeekday && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                <div>
                  <p className="text-xs text-gray-500">Días más activos</p>
                  <p className="text-base font-bold capitalize mt-0.5">{patterns.topWeekday}</p>
                </div>
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
            )}
          </div>

          {/* Smart Insights */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Análisis inteligente</h3>
            {smartInsights.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">Aún no hay análisis disponibles</p>
            ) : (
              smartInsights.map((ins, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70 flex items-start gap-3"
                >
                  {ins.tone === 'negative' && (
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  {ins.tone === 'neutral' && (
                    <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  {ins.tone === 'positive' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-bold">{ins.title}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {ins.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Spending Patterns */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Patrones de gasto</h3>
            {!patterns ? (
              <p className="text-xs text-gray-500">No hay suficientes datos</p>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                  <p className="text-[11px] text-gray-500">Día laborable vs fin de semana</p>
                  <p className="text-sm font-bold mt-0.5">{patterns.weekdayTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {patterns.weekdayDesc}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                  <p className="text-[11px] text-gray-500">Patrón mensual</p>
                  <p className="text-sm font-bold mt-0.5">{patterns.monthTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {patterns.monthDesc}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 4: Budget */}
      {analyticsTab === 'budget' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold">Definir presupuesto mensual</h3>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-base font-semibold focus:outline-none"
              />
              <button
                onClick={() => onSaveBudget(Number(budgetInput) || 0)}
                className="bg-blue-600 text-white text-sm font-semibold px-4 rounded-xl active:scale-95 transition"
              >
                Guardar
              </button>
            </div>
          </div>

          {currentBudget > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold">Proyección mensual</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                  <p className="text-gray-500">Proyectado fin de mes</p>
                  <p className="text-base font-bold mt-0.5">{fmt(projectedMonthlySpend)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70">
                  <p className="text-gray-500">Presupuesto diario restante</p>
                  <p className="text-base font-bold mt-0.5">
                    {fmt(Math.max(0, (currentBudget - totalSpent) / Math.max(1, daysRemaining)))}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {projectedMonthlySpend > currentBudget
                  ? 'Según tu proyección, superarás tu presupuesto.'
                  : 'Según tu proyección, te mantendrás bajo el presupuesto.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-zinc-400">{title}</p>
      <p className={`text-lg font-bold mt-1 truncate ${color}`}>{value}</p>
    </div>
  );
}

// ============================================================================
// 3. TRANSACTIONS TAB
// ============================================================================
function TransactionsTab({
  expenses,
  fmt,
  getCategory,
  getAccount,
  onEditTx,
  onAddTx,
}: {
  expenses: Expense[];
  fmt: (v: number) => string;
  getCategory: (id: string) => CategoryDef;
  getAccount: (id?: string) => Account | undefined;
  onEditTx: (e: Expense) => void;
  onAddTx: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => {
        if (filterType !== 'all' && e.type !== filterType) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            e.title.toLowerCase().includes(q) ||
            (e.notes && e.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'highest') return b.price - a.price;
        return a.price - b.price;
      });
  }, [expenses, filterType, search, sortBy]);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl px-3.5 py-2.5 flex items-center gap-2 shadow-sm">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar transacciones"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {/* Filter & Sort Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-gray-200/80 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
          {(
            [
              ['all', 'Todos'],
              ['expense', 'Gastos'],
              ['income', 'Ingresos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilterType(id)}
              className={`px-3 py-1 rounded-lg transition ${
                filterType === id
                  ? 'bg-white dark:bg-zinc-900 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white dark:bg-zinc-900 text-xs font-semibold px-3 py-2 rounded-xl shadow-sm focus:outline-none"
        >
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguos</option>
          <option value="highest">Mayor monto</option>
          <option value="lowest">Menor monto</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm font-medium text-gray-500">No se encontraron transacciones</p>
            <button
              onClick={onAddTx}
              className="text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-full"
            >
              Agregar transacción
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {filtered.map((tx) => {
              const cat = getCategory(tx.categoryID);
              const acc = getAccount(tx.accountID);
              return (
                <button
                  key={tx.id}
                  onClick={() => onEditTx(tx)}
                  className="w-full py-3 flex items-center justify-between text-left active:opacity-70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      {renderCategoryIcon(cat.icon, 'w-5 h-5')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{tx.title}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                        {cat.nameEs}
                        {acc ? ` • ${acc.name}` : ''} •{' '}
                        {new Date(tx.date).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold shrink-0 ml-2 ${
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {fmt(tx.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 4. ACCOUNTS TAB (Credit & Debit with cut dates, payment dates & manual balance)
// ============================================================================
function AccountsTab({
  accounts,
  expenses,
  fmt,
  onNewAccount,
  onEditAccount,
}: {
  accounts: Account[];
  expenses: Expense[];
  fmt: (v: number) => string;
  onNewAccount: () => void;
  onEditAccount: (a: Account) => void;
}) {
  const [expandedSavingsId, setExpandedSavingsId] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center space-y-3 shadow-sm mt-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
          <CreditCard className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold">Aún no hay cuentas</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-xs mx-auto">
          Agrega tus tarjetas de crédito, cuentas de débito o cuentas de ahorro/inversión con rendimiento diario.
        </p>
        <button
          onClick={onNewAccount}
          className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm"
        >
          Nueva cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {accounts.map((account) => {
        const isCredit = account.type === 'credit';
        const isSavings = account.type === 'savings';
        const consumed = getAccountConsumed(account, expenses);
        const available = getAccountAvailableBalance(account, expenses);
        const debitBalance = getAccountCurrentBalance(account, expenses);
        const savingsSummary = isSavings ? getSavingsSummary(account, expenses) : null;
        const days = getDaysUntilPayment(account);
        const pct =
          account.creditLimit > 0
            ? Math.min(100, Math.round((consumed / account.creditLimit) * 100))
            : 0;
        const isExpanded = expandedSavingsId === account.id;

        const badgeColor = isCredit
          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
          : isSavings
          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';

        const typeLabel = isCredit
          ? 'Crédito'
          : isSavings
          ? `Ahorro / Inversión • ${account.annualRate || 0}% anual`
          : 'Débito';

        return (
          <div
            key={account.id}
            onClick={() => onEditAccount(account)}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3.5 active:scale-[0.99] transition cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${badgeColor}`}>
                  {isCredit ? (
                    <CreditCard className="w-5 h-5" />
                  ) : isSavings ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <Banknote className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold">{account.name}</h3>
                  <p className="text-xs text-gray-500">
                    {typeLabel} • Toca para editar
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>
                {isCredit ? 'Crédito' : isSavings ? `${account.annualRate || 0}% GAT` : 'Débito'}
              </span>
            </div>

            {/* Main Balance */}
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {isCredit
                  ? 'Saldo disponible'
                  : isSavings
                  ? 'Saldo total (Capital + Rendimientos)'
                  : 'Saldo actual'}
              </p>
              <p
                className={`text-3xl font-bold tracking-tight mt-0.5 ${
                  isCredit && available < 0 ? 'text-red-500' : ''
                }`}
              >
                {fmt(
                  isCredit
                    ? available
                    : isSavings && savingsSummary
                    ? savingsSummary.totalBalance
                    : debitBalance
                )}
              </p>
            </div>

            {/* Savings / Investment Yield Breakdown */}
            {isSavings && savingsSummary && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 text-xs">
                  <div>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">Capital</p>
                    <p className="font-bold mt-0.5">{fmt(savingsSummary.principal)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">Hoy ganas</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      +{fmt(savingsSummary.todayYield)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      Ganado ({savingsSummary.daysElapsed}d)
                    </p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      +{fmt(savingsSummary.accumulatedYield)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/70 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">30 días:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{fmt(savingsSummary.projectedMonthlyYield)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/70 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-zinc-400">1 año:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{fmt(savingsSummary.projectedYearlyYield)}
                    </span>
                  </div>
                </div>

                {/* Toggle Day-by-Day Yield Table */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSavingsId(isExpanded ? null : account.id);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-between hover:bg-gray-200/70 dark:hover:bg-zinc-700/70 transition cursor-pointer"
                >
                  <span>
                    {isExpanded
                      ? 'Ocultar rendimientos día a día'
                      : 'Ver rendimientos día a día'}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden text-xs max-h-64 overflow-y-auto"
                  >
                    <div className="grid grid-cols-3 bg-gray-100 dark:bg-zinc-800 px-3 py-2 font-semibold text-[11px] text-gray-500 dark:text-zinc-400 sticky top-0">
                      <span>Día</span>
                      <span className="text-right">Rendimiento</span>
                      <span className="text-right">Saldo cierre</span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800/80">
                      {[...savingsSummary.dailyEntries]
                        .slice(-21)
                        .reverse()
                        .map((entry) => (
                          <div
                            key={entry.dateKey}
                            className={`grid grid-cols-3 px-3 py-2 items-center ${
                              entry.isProjected
                                ? 'bg-purple-50/40 dark:bg-purple-950/20 text-gray-500 dark:text-zinc-400'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {entry.date.toLocaleDateString('es-MX', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                              {entry.isProjected && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 font-semibold">
                                  Proy.
                                </span>
                              )}
                            </div>
                            <span className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +{fmt(entry.dailyYield)}
                            </span>
                            <span className="text-right font-semibold">
                              {fmt(entry.endingBalance)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit Progress & Cut/Payment Dates */}
            {isCredit && (
              <>
                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        consumed > account.creditLimit ? 'bg-red-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400">
                    <span>
                      Consumido: <strong className="text-gray-700 dark:text-zinc-200">{fmt(consumed)}</strong>
                    </span>
                    <span>
                      Límite: <strong className="text-gray-700 dark:text-zinc-200">{fmt(account.creditLimit)}</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[11px] text-gray-400">Día de corte</p>
                    <p className="font-bold">Día {account.cutDay}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Próximo corte</p>
                    <p className="font-bold">
                      {getNextCutDate(account).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400">Fecha de pago</p>
                    <p className="font-bold">
                      {getNextPaymentDate(account).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    days <= 3 ? 'text-amber-500' : 'text-gray-500 dark:text-zinc-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{days > 0 ? `Vence en ${days} días` : 'Pago vence hoy'}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 5. SETTINGS TAB
// ============================================================================
function SettingsTab({
  currency,
  setCurrency,
  theme,
  setTheme,
  defaultCategoryID,
  setDefaultCategoryID,
  expenses,
  accounts,
  budgets,
  onImportData,
  onResetAll,
}: {
  currency: string;
  setCurrency: (c: string) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  defaultCategoryID: string;
  setDefaultCategoryID: (c: string) => void;
  expenses: Expense[];
  accounts: Account[];
  budgets: Record<string, number>;
  onImportData: (d: {
    expenses?: Expense[];
    accounts?: Account[];
    budgets?: Record<string, number>;
  }) => void;
  onResetAll: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    const payload = {
      expenses,
      accounts,
      budgets,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inpenso-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        onImportData(parsed);
        alert('Tus datos se importaron correctamente.');
      } catch {
        alert('No se pudieron importar los datos. Verifica el formato del archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {/* Appearance */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Apariencia
        </h3>
        <div className="grid grid-cols-3 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
          {(
            [
              ['system', 'Sistema'],
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
            ] as [ThemeMode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`py-1.5 rounded-lg transition ${
                theme === id
                  ? 'bg-white dark:bg-zinc-900 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Currency & Default Category */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Moneda y configuración predeterminada
        </h3>

        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium">Moneda</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-gray-100 dark:bg-zinc-800 text-sm font-semibold px-3 py-1.5 rounded-xl focus:outline-none"
          >
            {AVAILABLE_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.nameEs} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-1 border-t border-gray-100 dark:border-zinc-800 pt-3">
          <span className="text-sm font-medium">Categoría predeterminada</span>
          <select
            value={defaultCategoryID}
            onChange={(e) => setDefaultCategoryID(e.target.value)}
            className="bg-gray-100 dark:bg-zinc-800 text-sm font-semibold px-3 py-1.5 rounded-xl focus:outline-none"
          >
            {BUILT_IN_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEs}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Gestión de datos
        </h3>

        <button
          onClick={handleExport}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70 text-sm font-medium"
        >
          <span>Exportar datos (JSON)</span>
          <Download className="w-4 h-4 text-blue-600" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70 text-sm font-medium"
        >
          <span>Importar datos (JSON)</span>
          <Upload className="w-4 h-4 text-blue-600" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => {
            if (
              confirm(
                'Esto eliminará todos tus gastos, cuentas y presupuestos. Esta acción no se puede deshacer.'
              )
            ) {
              onResetAll();
            }
          }}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm font-semibold"
        >
          <span>Restablecer todos los datos</span>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* About & Credits */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm space-y-2 text-xs text-gray-500 dark:text-zinc-400">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Acerca de
        </h3>
        <p>
          <strong>Inpenso Web (PWA)</strong> es una adaptación multiplataforma para navegador móvil basada en el proyecto original para iOS{' '}
          <a
            href="https://github.com/VintusS/Inpenso"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 dark:text-blue-400 font-semibold underline"
          >
            VintusS/Inpenso
          </a>
          .
        </p>
        <p>
          Incluye gestión de cuentas de crédito y débito, ajuste manual de saldo disponible, cálculo de fechas de corte y pago, soporte para MXN y funcionamiento offline como PWA.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 6. TRANSACTION MODAL (Add / Edit with Visual Account Selector)
// ============================================================================
function TransactionModal({
  initialTx,
  defaultCategoryID,
  accounts,
  currency,
  onClose,
  onSave,
  onDelete,
  onQuickCreateAccount,
}: {
  initialTx: Expense | null;
  defaultCategoryID: string;
  accounts: Account[];
  currency: string;
  onClose: () => void;
  onSave: (e: Expense) => void;
  onDelete: (id: string) => void;
  onQuickCreateAccount: (a: Account) => void;
}) {
  const [type, setType] = useState<TransactionType>(initialTx?.type || 'expense');
  const [title, setTitle] = useState(initialTx?.title || '');
  const [price, setPrice] = useState(initialTx ? String(initialTx.price) : '');
  const [categoryID, setCategoryID] = useState(initialTx?.categoryID || defaultCategoryID);
  const [accountID, setAccountID] = useState<string>(
    initialTx ? initialTx.accountID || '' : accounts[0]?.id || ''
  );
  const [date, setDate] = useState(
    initialTx
      ? new Date(initialTx.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialTx?.notes || '');
  const [quickAccName, setQuickAccName] = useState('');
  const [showQuickAcc, setShowQuickAcc] = useState(false);

  const handleSave = () => {
    if (!title.trim()) {
      alert('Por favor ingresa un título.');
      return;
    }
    const numPrice = Number(price);
    if (!numPrice || numPrice <= 0) {
      alert('Por favor ingresa un monto válido.');
      return;
    }
    const cat =
      BUILT_IN_CATEGORIES.find((c) => c.id === categoryID) || BUILT_IN_CATEGORIES[0];
    onSave({
      id: initialTx?.id || crypto.randomUUID(),
      title: title.trim(),
      price: numPrice,
      date: new Date(date + 'T12:00:00').toISOString(),
      category: cat.nameEn,
      type,
      categoryID,
      notes: notes.trim() || undefined,
      accountID: accountID || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center">
      <div className="bg-[#F2F2F7] dark:bg-zinc-950 w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-medium text-blue-600">
            Cancelar
          </button>
          <h2 className="text-base font-bold">
            {initialTx ? 'Editar transacción' : 'Agregar transacción'}
          </h2>
          <button onClick={handleSave} className="text-sm font-bold text-blue-600">
            Guardar
          </button>
        </div>

        {/* Transaction Details Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3.5 shadow-sm">
          <h3 className="text-sm font-semibold">Detalles de la transacción</h3>

          {/* Type Segmented */}
          <div className="grid grid-cols-2 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setType('expense')}
              className={`py-1.5 rounded-lg ${
                type === 'expense' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Gasto
            </button>
            <button
              onClick={() => setType('income')}
              className={`py-1.5 rounded-lg ${
                type === 'income' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Ingresos
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500">Título</label>
            <input
              type="text"
              placeholder={type === 'expense' ? 'Título del gasto' : 'Título del ingreso'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500">Monto ({currency})</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-xl font-bold focus:outline-none"
            />
          </div>

          {/* Visual Account Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Cuenta</label>
              <button
                type="button"
                onClick={() => setShowQuickAcc(!showQuickAcc)}
                className="text-xs font-semibold text-blue-600 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva cuenta</span>
              </button>
            </div>

            {showQuickAcc && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de tarjeta/cuenta"
                  value={quickAccName}
                  onChange={(e) => setQuickAccName(e.target.value)}
                  className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!quickAccName.trim()) return;
                    const newAcc: Account = {
                      id: crypto.randomUUID(),
                      name: quickAccName.trim(),
                      type: 'credit',
                      creditLimit: 0,
                      initialBalance: 0,
                      cutDay: 1,
                      graceDays: 20,
                      createdAt: new Date().toISOString(),
                    };
                    onQuickCreateAccount(newAcc);
                    setAccountID(newAcc.id);
                    setQuickAccName('');
                    setShowQuickAcc(false);
                  }}
                  className="bg-blue-600 text-white text-xs font-semibold px-3 rounded-xl"
                >
                  Crear
                </button>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setAccountID('')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 border transition ${
                  accountID === ''
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 dark:bg-zinc-800 border-transparent text-gray-700 dark:text-zinc-300'
                }`}
              >
                Ninguna
              </button>
              {accounts.map((acc) => {
                const selected = accountID === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccountID(acc.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 border flex items-center gap-1.5 transition ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-100 dark:bg-zinc-800 border-transparent text-gray-700 dark:text-zinc-300'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{acc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold">Categoría</h3>
          <div className="grid grid-cols-4 gap-2.5">
            {BUILT_IN_CATEGORIES.map((cat) => {
              const selected = categoryID === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryID(cat.id)}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1.5 border transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40'
                      : 'border-transparent bg-gray-50 dark:bg-zinc-800/60'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                  </div>
                  <span className="text-[11px] font-medium truncate w-full text-center">
                    {cat.nameEs}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date & Notes */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-sm font-medium"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar notas..."
              className="w-full mt-1.5 bg-gray-100 dark:bg-zinc-800 rounded-xl p-3 text-sm focus:outline-none"
            />
          </div>
        </div>

        {initialTx && (
          <button
            onClick={() => onDelete(initialTx.id)}
            className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-bold"
          >
            Eliminar transacción
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 7. ACCOUNT MODAL (Create / Edit with Manual Credit Available / Consumed Adjustment)
// ============================================================================
function AccountModal({
  initialAccount,
  expenses,
  currency,
  fmt,
  onClose,
  onSave,
  onDelete,
}: {
  initialAccount: Account | null;
  expenses: Expense[];
  currency: string;
  fmt: (v: number) => string;
  onClose: () => void;
  onSave: (a: Account) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(initialAccount?.name || '');
  const [type, setType] = useState<AccountType>(initialAccount?.type || 'credit');
  const [creditLimit, setCreditLimit] = useState(
    initialAccount && initialAccount.creditLimit > 0 ? String(initialAccount.creditLimit) : ''
  );
  const [adjustMode, setAdjustMode] = useState<'available' | 'consumed'>('available');

  const existingConsumed = initialAccount ? getAccountConsumed(initialAccount, expenses) : 0;
  const existingAvailable = initialAccount
    ? getAccountAvailableBalance(initialAccount, expenses)
    : 0;

  const [creditAvailable, setCreditAvailable] = useState(
    initialAccount ? String(existingAvailable) : ''
  );
  const [creditConsumed, setCreditConsumed] = useState(
    initialAccount && existingConsumed > 0 ? String(existingConsumed) : ''
  );
  const [debitBalance, setDebitBalance] = useState(
    initialAccount && (initialAccount.type === 'debit' || initialAccount.type === 'savings')
      ? String(initialAccount.initialBalance)
      : ''
  );
  const [annualRate, setAnnualRate] = useState(
    initialAccount && initialAccount.annualRate ? String(initialAccount.annualRate) : '12.5'
  );
  const [investmentStartDate, setInvestmentStartDate] = useState(
    initialAccount?.investmentStartDate
      ? initialAccount.investmentStartDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [cutDay, setCutDay] = useState(initialAccount?.cutDay || 1);
  const [graceDays, setGraceDays] = useState(initialAccount?.graceDays || 20);

  const limitNum = Number(creditLimit) || 0;
  const calculatedConsumed =
    adjustMode === 'consumed'
      ? Math.max(0, Number(creditConsumed) || 0)
      : creditAvailable !== ''
      ? Math.max(0, limitNum - (Number(creditAvailable) || 0))
      : 0;
  const calculatedAvailable = limitNum - calculatedConsumed;

  const previewAcc: Account = {
    id: initialAccount?.id || 'preview',
    name: name || 'Preview',
    type,
    creditLimit: limitNum,
    initialBalance: Number(debitBalance) || 0,
    cutDay,
    graceDays,
    createdAt: new Date().toISOString(),
    annualRate: Number(annualRate) || 0,
    investmentStartDate: new Date(investmentStartDate + 'T00:00:00').toISOString(),
  };

  const previewSavings = type === 'savings' ? getSavingsSummary(previewAcc, expenses) : null;

  const handleSave = () => {
    if (!name.trim()) {
      alert('El nombre de la cuenta es obligatorio');
      return;
    }
    const targetId = initialAccount?.id || crypto.randomUUID();
    const tempAcc: Account = {
      id: targetId,
      name: name.trim(),
      type,
      creditLimit: type === 'credit' ? limitNum : 0,
      initialBalance: 0,
      cutDay,
      graceDays,
      createdAt: initialAccount?.createdAt || new Date().toISOString(),
      annualRate: type === 'savings' ? Math.max(0, Number(annualRate) || 0) : undefined,
      investmentStartDate:
        type === 'savings'
          ? new Date(investmentStartDate + 'T00:00:00').toISOString()
          : undefined,
    };
    const cycleTx =
      type === 'credit' ? getCycleTransactionsConsumed(tempAcc, expenses) : 0;
    tempAcc.initialBalance =
      type === 'credit' ? calculatedConsumed - cycleTx : Number(debitBalance) || 0;

    onSave(tempAcc);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center">
      <div className="bg-[#F2F2F7] dark:bg-zinc-950 w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-medium text-blue-600">
            Cancelar
          </button>
          <h2 className="text-base font-bold">
            {initialAccount ? 'Editar cuenta' : 'Nueva cuenta'}
          </h2>
          <button onClick={handleSave} className="text-sm font-bold text-blue-600">
            Guardar
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3 shadow-sm">
          <div>
            <label className="text-xs text-gray-500">Nombre</label>
            <input
              type="text"
              placeholder="Nombre (ej. Cajita Nu, Cetes, BBVA)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setType('credit')}
              className={`py-1.5 rounded-lg ${
                type === 'credit' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Crédito
            </button>
            <button
              onClick={() => setType('debit')}
              className={`py-1.5 rounded-lg ${
                type === 'debit' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Débito
            </button>
            <button
              onClick={() => setType('savings')}
              className={`py-1.5 rounded-lg ${
                type === 'savings' ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Ahorro / Inv.
            </button>
          </div>
        </div>

        {type === 'credit' ? (
          <>
            {/* Credit Limit & Manual Balance Adjustment */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3 shadow-sm">
              <div>
                <label className="text-xs text-gray-500">Límite de crédito ({currency})</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-bold focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2.5">
                <label className="text-xs font-semibold text-gray-500">
                  Saldo actual (ajuste manual)
                </label>
                <div className="grid grid-cols-2 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => {
                      setCreditAvailable(String(Math.max(0, limitNum - calculatedConsumed)));
                      setAdjustMode('available');
                    }}
                    className={`py-1.5 rounded-lg ${
                      adjustMode === 'available'
                        ? 'bg-white dark:bg-zinc-900 shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    Por Saldo disponible
                  </button>
                  <button
                    onClick={() => {
                      setCreditConsumed(String(calculatedConsumed));
                      setAdjustMode('consumed');
                    }}
                    className={`py-1.5 rounded-lg ${
                      adjustMode === 'consumed'
                        ? 'bg-white dark:bg-zinc-900 shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    Por Consumido
                  </button>
                </div>

                {adjustMode === 'available' ? (
                  <div>
                    <label className="text-xs text-gray-500">Saldo disponible actual</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={creditAvailable}
                      onChange={(e) => setCreditAvailable(e.target.value)}
                      className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-bold focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-500">Consumido actual</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={creditConsumed}
                      onChange={(e) => setCreditConsumed(e.target.value)}
                      className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-bold focus:outline-none"
                    />
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Consumido:</span>
                    <span className="font-bold">{fmt(calculatedConsumed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Saldo disponible:</span>
                    <span className="font-bold text-blue-600">{fmt(calculatedAvailable)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cut Day & Grace Days */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Día de corte (1–31)</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cutDay}
                  onChange={(e) =>
                    setCutDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="w-20 text-center bg-gray-100 dark:bg-zinc-800 rounded-xl py-1.5 font-bold"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Días para pagar</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={graceDays}
                  onChange={(e) =>
                    setGraceDays(Math.min(60, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="w-20 text-center bg-gray-100 dark:bg-zinc-800 rounded-xl py-1.5 font-bold"
                />
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Próximo corte:</span>
                  <span className="font-bold">
                    {getNextCutDate(previewAcc).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha de pago:</span>
                  <span className="font-bold">
                    {getNextPaymentDate(previewAcc).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : type === 'savings' ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-3.5 shadow-sm">
            <div>
              <label className="text-xs text-gray-500">
                Capital / Saldo inicial invertido ({currency})
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={debitBalance}
                onChange={(e) => setDebitBalance(e.target.value)}
                className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-bold focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Tasa fija anual (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="12.5"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(e.target.value)}
                  className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-base font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Inicio de inversión</label>
                <input
                  type="date"
                  value={investmentStartDate}
                  onChange={(e) => setInvestmentStartDate(e.target.value)}
                  className="w-full mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {previewSavings && (
              <div className="bg-purple-50/60 dark:bg-purple-950/30 rounded-xl p-3 text-xs space-y-1.5">
                <p className="font-semibold text-purple-600 dark:text-purple-400">
                  Vista previa de rendimientos (interés compuesto diario)
                </p>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rendimiento diario (hoy):</span>
                  <span className="font-bold text-emerald-600">
                    +{fmt(previewSavings.todayYield)} / día
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Acumulado ({previewSavings.daysElapsed} días):
                  </span>
                  <span className="font-bold text-emerald-600">
                    +{fmt(previewSavings.accumulatedYield)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proyección a 30 días:</span>
                  <span className="font-bold text-emerald-600">
                    +{fmt(previewSavings.projectedMonthlyYield)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proyección a 1 año (365d):</span>
                  <span className="font-bold text-emerald-600">
                    +{fmt(previewSavings.projectedYearlyYield)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-2 shadow-sm">
            <label className="text-xs text-gray-500">Saldo inicial ({currency})</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={debitBalance}
              onChange={(e) => setDebitBalance(e.target.value)}
              className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-bold focus:outline-none"
            />
          </div>
        )}

        {initialAccount && (
          <button
            onClick={() => onDelete(initialAccount.id)}
            className="w-full py-3 rounded-2xl bg-red-500 text-white text-sm font-bold"
          >
            Eliminar cuenta
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 8. ASSISTANT MODAL (Native FoundationModels Bridge + Safari Local Engine / API)
// ============================================================================
function AssistantModal({
  expenses,
  accounts,
  budgets,
  currency,
  apiKey,
  setApiKey,
  onClose,
}: {
  expenses: Expense[];
  accounts: Account[];
  budgets: Record<string, number>;
  currency: string;
  apiKey: string;
  setApiKey: (k: string) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; source?: string }[]
  >([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);

  const isNativeAppleIntelligence = hasNativeAppleIntelligenceBridge();

  const suggestions = [
    '¿Cuánto gasté este mes?',
    '¿Cuál es mi categoría de gasto más grande?',
    '¿Voy bien con mi presupuesto?',
    '¿Cuál es el saldo y fecha de pago de mis tarjetas?',
    'Dame 3 consejos para ahorrar dinero',
  ];

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    try {
      const res = await askAssistant({
        prompt: trimmed,
        expenses,
        accounts,
        budgets,
        currency,
        apiKey,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.text, source: res.source },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error: ${(err as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center">
      <div className="bg-[#F2F2F7] dark:bg-zinc-950 w-full max-w-md rounded-t-3xl sm:rounded-3xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base font-bold">Asistente</h2>
              <p className="text-[11px] text-gray-500">
                {isNativeAppleIntelligence
                  ? 'Apple Intelligence en dispositivo (FoundationModels)'
                  : 'Motor financiero local en dispositivo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="text-xs text-blue-600 font-medium"
            >
              API
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-gray-100 dark:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showKeyConfig && (
          <div className="p-3 bg-blue-50 dark:bg-zinc-900 border-b border-blue-100 dark:border-zinc-800 space-y-1.5">
            <p className="text-[11px] text-gray-600 dark:text-zinc-400">
              En un `.ipa` usa automáticamente **Apple Intelligence (`FoundationModels`)**. En
              Safari funciona 100% local, o puedes pegar una API Key opcional:
            </p>
            <input
              type="password"
              placeholder="sk-... (opcional)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-xs"
            />
          </div>
        )}

        {/* Messages / Suggestions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-4">
              <div className="text-center space-y-1">
                <p className="text-base font-bold">Pregunta sobre tu dinero</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Tus datos financieros se procesan en tu dispositivo y nunca salen de tu iPhone.
                </p>
              </div>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendPrompt(s)}
                    className="w-full text-left p-3 rounded-2xl bg-white dark:bg-zinc-900 text-xs font-medium shadow-xs hover:bg-blue-50 dark:hover:bg-zinc-800 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(input);
          }}
          className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Pregunta sobre tus finanzas…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-full px-4 py-2.5 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
