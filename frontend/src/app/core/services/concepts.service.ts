import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { Concept } from '../models';

@Injectable({ providedIn: 'root' })
export class ConceptsService {
  private http = inject(HttpClient);

  list(): Observable<Concept[]> {
    return this.http.get<Concept[]>(`${API_BASE}/concepts`);
  }

  assignCategory(id: string, categoryId: string | null): Observable<unknown> {
    return this.http.patch(`${API_BASE}/concepts/${id}/category`, { categoryId });
  }

  autoCategorize(): Observable<{ assigned: number; remaining: number }> {
    return this.http.post<{ assigned: number; remaining: number }>(
      `${API_BASE}/concepts/auto-categorize`,
      {},
    );
  }
}
