export type AppLanguage = 'en' | 'es';
export type AppTheme = 'light' | 'dark';

/** Filter-bar state saved as the user's default for a page (keyed by page). */
export interface SavedFilterState {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  card?: string;
  currency?: string;
  category?: string;
  concept?: string;
  search?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  mobilePhone: string | null;
  emailVerified: boolean;
  language: AppLanguage;
  currency: string;
  theme: AppTheme;
  savedFilters: Record<string, SavedFilterState>;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
}

export interface Concept {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  expenseCount: number;
  totalValor: number;
}

export type ExpenseKind = 'expense' | 'payment';

export interface Expense {
  id: string;
  fecha: string;
  tarjeta: string | null;
  noTarjeta: string | null;
  nombre: string | null;
  tipoMovimiento: string | null;
  noDoc: string | null;
  comercio: string;
  valor: number;
  saldo: number | null;
  kind: ExpenseKind;
  excluded: boolean;
  currency: string;
  /**
   * Rate to the user's base currency at `fecha` (converted value =
   * valor * exchangeRate). Null while the conversion is pending.
   */
  exchangeRate: number | null;
  conceptId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  recurringExpenseId: string | null;
}

/** Payload for manually creating/editing an expense or payment. */
export interface ExpenseInput {
  fecha: string;
  comercio: string;
  valor: number;
  kind?: ExpenseKind;
  currency?: string;
  tarjeta?: string;
  noTarjeta?: string;
  tipoMovimiento?: string;
  /** Assigns the merchant's concept to this category (all its expenses). */
  categoryId?: string;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface PagedExpenses {
  items: Expense[];
  total: number;
  totalsByCurrency: CurrencyTotal[];
  page: number;
  size: number;
}

export interface ExpenseQuery {
  dateFrom?: string;
  dateTo?: string;
  card?: string;
  search?: string;
  conceptId?: string;
  categoryId?: string;
  categoryFilter?: string;
  kind?: 'expense' | 'payment' | 'all';
  currency?: string;
  page?: number;
  size?: number;
  sortField?: string;
  sortOrder?: string;
}

export interface DashboardSummary {
  /** User's base currency — all converted totals below are in it. */
  baseCurrency: string;
  totalValor: number;
  count: number;
  avgValor: number;
  /** Foreign-currency rows without a rate, excluded from converted totals. */
  unconvertedCount: number;
  byCurrency: CurrencyTotal[];
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    color: string;
    total: number;
    count: number;
  }[];
  byCard: { card: string; total: number; count: number }[];
  byMonth: { month: string; total: number; count: number }[];
  /** Per-day totals within the range (day is YYYY-MM-DD). */
  byDay: { day: string; total: number; count: number }[];
  /**
   * Totals for the selected window and the 3 preceding windows of the same
   * length, oldest first. Empty for ranges longer than 31 days or without dates.
   */
  previousPeriods: { from: string; to: string; total: number; count: number }[];
  topMerchants: { comercio: string; total: number; count: number }[];
}

export interface ImportResult {
  batchId: string | null;
  filename: string;
  rowCount: number;
  paymentsImported: number;
  duplicatesSkipped: number;
  totalRows: number;
  newConcepts: number;
  /** Merchants auto-assigned a category (0 when suggestions were off). */
  autoCategorized: number;
  metadata: {
    cardholderName: string | null;
    cardNumber: string | null;
    creditLimit: number | null;
    availableLimit: number | null;
    pastDueBalance: number | null;
    minimumPayment: number | null;
    statementDate: string | null;
    paymentDueDate: string | null;
  };
}

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/** Fixed/recurring expense template; real expenses are generated from it. */
export interface RecurringExpense {
  id: string;
  comercio: string;
  valor: number;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  active: boolean;
  tarjeta: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  generatedCount: number;
  lastGeneratedDate: string | null;
  createdAt: string;
}

export interface RecurringExpenseInput {
  comercio: string;
  valor: number;
  currency?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  /** Empty string clears the end date (open-ended). */
  endDate?: string;
  tarjeta?: string;
  active?: boolean;
  /** Assigns the merchant's concept to this category (all its expenses). */
  categoryId?: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  rowCount: number;
  cardholderName: string | null;
  cardNumber: string | null;
  importedAt: string;
}
