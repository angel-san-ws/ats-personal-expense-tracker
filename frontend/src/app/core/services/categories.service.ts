import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { Category } from '../models';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private http = inject(HttpClient);

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_BASE}/categories`);
  }

  create(name: string, color: string): Observable<Category> {
    return this.http.post<Category>(`${API_BASE}/categories`, { name, color });
  }

  update(id: string, changes: { name?: string; color?: string }): Observable<Category> {
    return this.http.patch<Category>(`${API_BASE}/categories/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/categories/${id}`);
  }
}
