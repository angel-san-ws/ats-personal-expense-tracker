import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { Budget, BudgetStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private http = inject(HttpClient);

  list(): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${API_BASE}/budgets`);
  }

  /** Budget vs actual for a month (YYYY-MM, default current). */
  status(month?: string): Observable<BudgetStatus> {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<BudgetStatus>(`${API_BASE}/budgets/status`, { params });
  }

  /** Set the budget for a category, or the overall budget when categoryId is null. */
  upsert(categoryId: string | null, amount: number): Observable<Budget> {
    return this.http.put<Budget>(`${API_BASE}/budgets`, {
      categoryId: categoryId ?? undefined,
      amount,
    });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/budgets/${id}`);
  }
}
