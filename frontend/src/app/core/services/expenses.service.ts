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
} from '../models';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);

  private toParams(query: ExpenseQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
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

  cards(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/expenses/cards`);
  }

  currencies(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/expenses/currencies`);
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

  batchDelete(ids: string[]): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${API_BASE}/expenses/batch-delete`,
      { ids },
    );
  }
}
