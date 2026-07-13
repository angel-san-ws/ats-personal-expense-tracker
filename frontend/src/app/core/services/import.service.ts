import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { ImportBatch, ImportResult, PaymentReminder } from '../models';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private http = inject(HttpClient);

  upload(file: File, suggestCategories = false): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('suggestCategories', String(suggestCategories));
    return this.http.post<ImportResult>(`${API_BASE}/import/excel`, form);
  }

  uploadScreenshots(
    files: File[],
    suggestCategories = false,
  ): Observable<ImportResult> {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    form.append('suggestCategories', String(suggestCategories));
    return this.http.post<ImportResult>(`${API_BASE}/import/screenshot`, form);
  }

  paymentReminders(): Observable<PaymentReminder[]> {
    return this.http.get<PaymentReminder[]>(
      `${API_BASE}/import/payment-reminders`,
    );
  }

  /** Hide an account's reminder until after the given due date. */
  dismissReminder(accountId: string, dueDate: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/import/payment-reminders/dismiss`, {
      accountId,
      dueDate,
    });
  }

  batches(): Observable<ImportBatch[]> {
    return this.http.get<ImportBatch[]>(`${API_BASE}/import/batches`);
  }

  deleteBatch(id: string): Observable<{ deletedExpenses: number }> {
    return this.http.delete<{ deletedExpenses: number }>(
      `${API_BASE}/import/batches/${id}`,
    );
  }
}
