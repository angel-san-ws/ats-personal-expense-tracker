import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { RecurringExpense, RecurringExpenseInput } from '../models';

@Injectable({ providedIn: 'root' })
export class RecurringExpensesService {
  private http = inject(HttpClient);

  list(): Observable<RecurringExpense[]> {
    return this.http.get<RecurringExpense[]>(`${API_BASE}/recurring-expenses`);
  }

  create(input: RecurringExpenseInput): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(
      `${API_BASE}/recurring-expenses`,
      input,
    );
  }

  update(
    id: string,
    changes: Partial<RecurringExpenseInput>,
  ): Observable<RecurringExpense> {
    return this.http.patch<RecurringExpense>(
      `${API_BASE}/recurring-expenses/${id}`,
      changes,
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/recurring-expenses/${id}`);
  }

  /** Catch-up generation of all due expense instances. */
  generate(): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(
      `${API_BASE}/recurring-expenses/generate`,
      {},
    );
  }
}
