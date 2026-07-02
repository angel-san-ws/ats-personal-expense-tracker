import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../api.config';
import { AuthResult, AppLanguage, User } from '../models';
import { LanguageService } from '../i18n/language.service';

const TOKEN_KEY = 'ats_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private lang = inject(LanguageService);

  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  register(
    email: string,
    name: string,
    password: string,
    language: AppLanguage,
  ): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_BASE}/auth/register`, { email, name, password, language })
      .pipe(tap((res) => this.setSession(res)));
  }

  login(email: string, password: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_BASE}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  /** Load the current user from a stored token (on app start). */
  loadMe(): Observable<User> {
    return this.http
      .get<User>(`${API_BASE}/auth/me`)
      .pipe(
        tap((user) => {
          this._user.set(user);
          this.lang.use(user.language);
        }),
      );
  }

  setUser(user: User): void {
    this._user.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(res: AuthResult): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this._user.set(res.user);
    // The account's saved language wins over the browser-detected one.
    this.lang.use(res.user.language);
  }
}
