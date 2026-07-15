import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import {
  DashboardSummary,
  Expense,
  ExpenseInput,
  ExpenseQuery,
  PagedExpenses,
  TagCount,
  YearReport,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);

  private toParams(query: ExpenseQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // e.g. tags — sent comma-separated; the backend splits them back.
        if (value.length) params = params.set(key, value.join(','));
      } else if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  list(query: ExpenseQuery): Observable<PagedExpenses> {
    return this.http.get<PagedExpenses>(`${API_BASE}/expenses`, {
      params: this.toParams(query),
    });
  }

  summary(query: ExpenseQuery): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${API_BASE}/expenses/summary`, {
      params: this.toParams(query),
    });
  }

  /** Yearly trends report: monthly totals, category series, budget vs. actual. */
  report(year: number): Observable<YearReport> {
    return this.http.get<YearReport>(`${API_BASE}/expenses/report`, {
      params: new HttpParams().set('year', year),
    });
  }

  /** Distinct card names / card numbers / movement types, for suggestion dropdowns. */
  fieldOptions(): Observable<{
    tarjetas: string[];
    noTarjetas: string[];
    tipoMovimientos: string[];
  }> {
    return this.http.get<{
      tarjetas: string[];
      noTarjetas: string[];
      tipoMovimientos: string[];
    }>(`${API_BASE}/expenses/field-options`);
  }

  currencies(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/expenses/currencies`);
  }

  /** The user's distinct tags with usage counts, most used first. */
  tags(): Observable<TagCount[]> {
    return this.http.get<TagCount[]>(`${API_BASE}/expenses/tags`);
  }

  setExcluded(id: string, excluded: boolean): Observable<void> {
    return this.http.patch<void>(`${API_BASE}/expenses/${id}/excluded`, {
      excluded,
    });
  }

  create(input: ExpenseInput): Observable<Expense> {
    return this.http.post<Expense>(`${API_BASE}/expenses`, input);
  }

  update(id: string, changes: Partial<ExpenseInput>): Observable<Expense> {
    return this.http.patch<Expense>(`${API_BASE}/expenses/${id}`, changes);
  }

  /** Backfill/retry exchange-rate stamping for rows pending conversion. */
  refreshRates(): Observable<{ stamped: number; remaining: number }> {
    return this.http.post<{ stamped: number; remaining: number }>(
      `${API_BASE}/expenses/refresh-rates`,
      {},
    );
  }

  /**
   * Assign a category to the merchants (concepts) of the given expenses.
   * Affects every expense of those merchants; null clears the category.
   */
  batchAssignCategory(
    ids: string[],
    categoryId: string | null,
  ): Observable<{ concepts: number }> {
    return this.http.post<{ concepts: number }>(
      `${API_BASE}/expenses/batch-assign-category`,
      { ids, categoryId },
    );
  }

  /**
   * Apply the provided fields to all given expenses. Omitted fields are left
   * untouched; a merchant change also re-links the rows to that merchant's
   * concept/category on the backend.
   */
  batchUpdate(
    ids: string[],
    changes: {
      accountId?: string | null;
      tarjeta?: string;
      noTarjeta?: string;
      tipoMovimiento?: string;
      comercio?: string;
    },
  ): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${API_BASE}/expenses/batch-update`,
      { ids, ...changes },
    );
  }

  batchDelete(ids: string[]): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${API_BASE}/expenses/batch-delete`,
      { ids },
    );
  }
}
