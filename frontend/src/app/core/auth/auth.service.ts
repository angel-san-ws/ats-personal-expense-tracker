import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../api.config';
import { AuthResult, AppLanguage, User } from '../models';
import { LanguageService } from '../i18n/language.service';
import { ThemeService } from '../theme.service';

const TOKEN_KEY = 'ats_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private theme = inject(ThemeService);

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
      .post<AuthResult>(`${API_BASE}/auth/register`, {
        email,
        name,
        password,
        language,
        // Browser-detected theme, so the account starts with what the user saw.
        theme: this.theme.current(),
      })
      .pipe(tap((res) => this.setSession(res)));
  }

  login(email: string, password: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_BASE}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  /** Exchange a Google ID token for our JWT (creates the account on first login). */
  googleLogin(credential: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>(`${API_BASE}/auth/google`, {
        credential,
        // Used only if this sign-in creates a new account.
        language: this.lang.active,
        theme: this.theme.current(),
      })
      .pipe(tap((res) => this.setSession(res)));
  }

  /** Consume the token from an emailed verification link (public endpoint). */
  verifyEmail(token: string): Observable<{ verified: boolean; email: string }> {
    return this.http.post<{ verified: boolean; email: string }>(
      `${API_BASE}/auth/verify-email`,
      { token },
    );
  }

  /** Re-send the verification email for the logged-in user. */
  resendVerification(): Observable<{ sent: boolean; alreadyVerified: boolean }> {
    return this.http.post<{ sent: boolean; alreadyVerified: boolean }>(
      `${API_BASE}/auth/resend-verification`,
      {},
    );
  }

  /** Request a password-reset email (public; always reports success). */
  forgotPassword(email: string): Observable<{ sent: boolean }> {
    return this.http.post<{ sent: boolean }>(
      `${API_BASE}/auth/forgot-password`,
      { email },
    );
  }

  /** Consume the token from an emailed reset link and set the new password. */
  resetPassword(
    token: string,
    password: string,
  ): Observable<{ reset: boolean; email: string }> {
    return this.http.post<{ reset: boolean; email: string }>(
      `${API_BASE}/auth/reset-password`,
      { token, password },
    );
  }

  /** Load the current user from a stored token (on app start). */
  loadMe(): Observable<User> {
    return this.http
      .get<User>(`${API_BASE}/auth/me`)
      .pipe(
        tap((user) => {
          this._user.set(user);
          this.lang.use(user.language);
          this.theme.use(user.theme);
        }),
      );
  }

  /** Drop a stored token the backend rejected, without navigating (app startup). */
  clearStaleToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  setUser(user: User): void {
    this._user.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    // Drop per-page filter state so the next login starts from the filters
    // saved on that account, not this session's leftovers.
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('ats-filters:')) sessionStorage.removeItem(key);
    }
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(res: AuthResult): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this._user.set(res.user);
    // The account's saved language/theme win over the browser-detected ones.
    this.lang.use(res.user.language);
    this.theme.use(res.user.theme);
  }
}
