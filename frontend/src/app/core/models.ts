export type AppLanguage = 'en' | 'es';
export type AppTheme = 'light' | 'dark';

/** Filter-bar state saved as the user's default for a page (keyed by page). */
export interface SavedFilterState {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Account id. */
  account?: string;
  /** Legacy raw card value from before accounts existed; no longer applied. */
  card?: string;
  currency?: string;
  category?: string;
  concept?: string;
  search?: string;
  tags?: string[];
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
  notifyPaymentDue: boolean;
  notifyBudgetOverspend: boolean;
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

export type AccountType =
  | 'credit_card'
  | 'debit_card'
  | 'checking'
  | 'savings'
  | 'cash'
  | 'other';

/**
 * A payment source (credit card, bank account, cash…). Auto-created at import
 * from the statement's card columns; name/type/color are user-editable.
 */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  lastFour: string | null;
  institution: string | null;
  color: string | null;
  archived: boolean;
  creditLimit: number | null;
  /** Day of month (1–31) the payment is due; drives manual reminders. */
  paymentDueDay: number | null;
  /** Payment reminders due on or before this date are dismissed (hidden). */
  reminderDismissedThrough: string | null;
  createdAt: string;
}

export interface AccountInput {
  name?: string;
  type?: AccountType;
  lastFour?: string;
  institution?: string;
  color?: string;
  archived?: boolean;
  creditLimit?: number;
  /** Day of month (1–31); null clears it and stops manual reminders. */
  paymentDueDay?: number | null;
}

export type ExpenseKind = 'expense' | 'payment';

export interface Expense {
  id: string;
  fecha: string;
  accountId: string | null;
  accountName: string | null;
  accountColor: string | null;
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
  /** Free-form labels (normalized to lowercase on the backend). */
  tags: string[];
  /** Free-text note attached by the user. */
  notes: string | null;
}

/** Payload for manually creating/editing an expense or payment. */
export interface ExpenseInput {
  fecha: string;
  comercio: string;
  valor: number;
  kind?: ExpenseKind;
  currency?: string;
  /** Payment source; null detaches the expense from any account. */
  accountId?: string | null;
  tarjeta?: string;
  noTarjeta?: string;
  tipoMovimiento?: string;
  /** Assigns the merchant's concept to this category (all its expenses). */
  categoryId?: string;
  /** Free-form labels; empty array clears them on edit. */
  tags?: string[];
  /** Free-text note; empty string clears it on edit. */
  notes?: string;
}

/** One of the user's tags with how many expenses carry it. */
export interface TagCount {
  tag: string;
  count: number;
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
  accountId?: string;
  card?: string;
  search?: string;
  conceptId?: string;
  categoryId?: string;
  categoryFilter?: string;
  kind?: 'expense' | 'payment' | 'all';
  currency?: string;
  /** Rows matching ANY of these tags (sent comma-separated). */
  tags?: string[];
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
  byAccount: {
    accountId: string | null;
    name: string;
    color: string | null;
    total: number;
    count: number;
  }[];
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
  accountId: string | null;
  accountName: string | null;
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
  /** Payment source copied onto generated expenses; null clears it. */
  accountId?: string | null;
  active?: boolean;
  /** Assigns the merchant's concept to this category (all its expenses). */
  categoryId?: string;
}

/**
 * Monthly spending limit in the user's base currency.
 * A null categoryId is the overall budget across all spending; a null month
 * is the standing amount, otherwise an override for that month (YYYY-MM).
 */
export interface Budget {
  id: string;
  categoryId: string | null;
  month: string | null;
  amount: number;
  createdAt: string;
}

/** The limits that apply to one target (a category or the overall budget). */
export interface BudgetLimit {
  /** Standing budget row; null when none is set. */
  budgetId: string | null;
  /** Standing monthly limit; null when none is set. */
  amount: number | null;
  /** Override row for the viewed month; null when none is set. */
  overrideId: string | null;
  overrideAmount: number | null;
  /** The limit in effect for the month: override, else the standing amount. */
  effectiveAmount: number | null;
}

export interface BudgetCategoryStatus extends BudgetLimit {
  categoryId: string;
  categoryName: string;
  color: string;
  /** Spend for the month, converted to the base currency. */
  spent: number;
  /**
   * Portion of `spent` generated from recurring expense templates — fixed
   * amounts that projections count at face value instead of extrapolating.
   */
  recurringSpent: number;
}

/** Budget vs actual for one month. */
export interface BudgetStatus {
  month: string;
  baseCurrency: string;
  /** Foreign-currency rows without a rate, excluded from the spent totals. */
  unconvertedCount: number;
  overall: BudgetLimit & { spent: number; recurringSpent: number };
  categories: BudgetCategoryStatus[];
}

export interface YearReportMonth {
  /** YYYY-MM */
  month: string;
  /** Spend for the month, converted to the base currency. */
  total: number;
  count: number;
  /** Converted spend for the same calendar month of the previous year. */
  prevTotal: number;
  /** Effective budget limit for the month; null when no budget applies. */
  budget: number | null;
}

export interface YearReportCategory {
  categoryId: string | null;
  categoryName: string;
  color: string;
  /** Converted total per month; index 0 = January. */
  monthlyTotals: number[];
  total: number;
}

/** Yearly trends: monthly totals, per-category series, budget vs. actual. */
export interface YearReport {
  year: number;
  /** User's base currency — every converted figure below is in it. */
  baseCurrency: string;
  /** Always 12 entries, January through December. */
  months: YearReportMonth[];
  /** Ordered by year total, descending. */
  byCategory: YearReportCategory[];
  yearTotal: number;
  prevYearTotal: number;
  /** Year total averaged over the months that have any spend. */
  monthlyAverage: number;
  /** Foreign-currency rows without a rate, excluded from converted totals. */
  unconvertedCount: number;
}

export type PaymentReminderStatus = 'upcoming' | 'dueSoon' | 'overdue' | 'paid';

/**
 * Due-date reminder for one account, derived from its latest imported
 * statement. `paid` means a payment was registered after the statement cut.
 */
export interface PaymentReminder {
  accountId: string;
  accountName: string;
  accountColor: string | null;
  lastFour: string | null;
  dueDate: string;
  statementDate: string | null;
  minimumPayment: number | null;
  pastDueBalance: number | null;
  /** Negative once the due date has passed. */
  daysUntilDue: number;
  status: PaymentReminderStatus;
  /** 'statement' = exact date from an import; 'manual' = account's due day. */
  source: 'statement' | 'manual';
  paidDate: string | null;
  paidAmount: number | null;
  paidCurrency: string | null;
}

export interface ImportBatch {
  id: string;
  filename: string;
  rowCount: number;
  cardholderName: string | null;
  cardNumber: string | null;
  importedAt: string;
}
