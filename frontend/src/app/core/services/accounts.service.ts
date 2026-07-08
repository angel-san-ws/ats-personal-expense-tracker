import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { Account, AccountInput } from '../models';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private http = inject(HttpClient);

  list(): Observable<Account[]> {
    return this.http.get<Account[]>(`${API_BASE}/accounts`);
  }

  create(input: AccountInput & { name: string }): Observable<Account> {
    return this.http.post<Account>(`${API_BASE}/accounts`, input);
  }

  update(id: string, changes: AccountInput): Observable<Account> {
    return this.http.patch<Account>(`${API_BASE}/accounts/${id}`, changes);
  }

  /** Only accounts without transactions can be deleted; archive the rest. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/accounts/${id}`);
  }
}
