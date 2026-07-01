import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AppLanguage } from '../models';

const LANG_KEY = 'ats_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private transloco = inject(TranslocoService);
  readonly current = signal<AppLanguage>('en');

  init(): void {
    const stored = (localStorage.getItem(LANG_KEY) as AppLanguage) || 'en';
    this.use(stored);
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
