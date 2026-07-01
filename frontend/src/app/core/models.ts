export type AppLanguage = 'en' | 'es';

export interface User {
  id: string;
  email: string;
  name: string;
  language: AppLanguage;
  currency: string;
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
  conceptId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
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
  totalValor: number;
  count: number;
  avgValor: number;
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

export interface ImportBatch {
  id: string;
  filename: string;
  rowCount: number;
  cardholderName: string | null;
  cardNumber: string | null;
  importedAt: string;
}
