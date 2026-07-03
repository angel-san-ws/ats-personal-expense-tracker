import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from '../api.config';
import { AppLanguage, AppTheme, SavedFilterState, User } from '../models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);

  updateProfile(name: string): Observable<User> {
    return this.http.patch<User>(`${API_BASE}/users/me/profile`, { name });
  }

  updateSettings(settings: {
    language?: AppLanguage;
    currency?: string;
    theme?: AppTheme;
  }): Observable<User> {
    return this.http.patch<User>(`${API_BASE}/users/me/settings`, settings);
  }

  saveFilter(key: string, filter: SavedFilterState): Observable<User> {
    return this.http.put<User>(`${API_BASE}/users/me/filters/${key}`, filter);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${API_BASE}/users/me/password`, {
      currentPassword,
      newPassword,
    });
  }
}
