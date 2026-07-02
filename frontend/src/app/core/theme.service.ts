import { Injectable, signal } from '@angular/core';
import { AppTheme } from './models';

const THEME_KEY = 'ats_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<AppTheme>('light');

  init(): void {
    const stored = localStorage.getItem(THEME_KEY);
    const theme =
      stored === 'light' || stored === 'dark' ? stored : detectBrowserTheme();
    this.use(theme);
  }

  use(theme: AppTheme): void {
    // PrimeNG's darkModeSelector (app.config.ts) keys off this class.
    document.documentElement.classList.toggle('app-dark', theme === 'dark');
    this.current.set(theme);
    localStorage.setItem(THEME_KEY, theme);
  }
}

/** OS/browser preference, used before the user has picked a theme. */
function detectBrowserTheme(): AppTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
