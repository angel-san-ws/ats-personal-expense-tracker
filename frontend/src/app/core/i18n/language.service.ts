import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AppLanguage } from '../models';

const LANG_KEY = 'ats_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private transloco = inject(TranslocoService);
  readonly current = signal<AppLanguage>('en');

  init(): void {
    const stored = localStorage.getItem(LANG_KEY);
    const lang =
      stored === 'en' || stored === 'es' ? stored : detectBrowserLanguage();
    this.use(lang);
  }

  use(lang: AppLanguage): void {
    this.transloco.setActiveLang(lang);
    this.current.set(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  get active(): AppLanguage {
    return this.current();
  }
}

/** OS/browser preference, used before the user has picked a language. */
function detectBrowserLanguage(): AppLanguage {
  const preferred = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of preferred) {
    const base = tag?.slice(0, 2).toLowerCase();
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return 'en';
}
