import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';

import { GOOGLE_CLIENT_ID } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme.service';

/** Minimal typings for the Google Identity Services script. */
interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline' | 'filled_black';
      size: 'large';
      text: 'continue_with';
      width: number;
      locale: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let gisScript: Promise<void> | undefined;

/** Load the GIS script once per app; resolves when window.google is usable. */
function loadGis(): Promise<void> {
  gisScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScript = undefined; // allow a retry on the next component init
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

/**
 * "Continue with Google" button for the login/register pages. Renders Google's
 * own button (GIS), exchanges the returned ID token for our JWT via
 * POST /auth/google and navigates to the dashboard.
 */
@Component({
  selector: 'app-google-signin',
  imports: [TranslocoDirective, DividerModule, MessageModule],
  template: `
    <div *transloco="let t">
      <p-divider align="center">
        <span class="text-sm text-color-secondary">{{ t('auth.orDivider') }}</span>
      </p-divider>
      @if (error()) {
        <p-message severity="error" [text]="t('auth.googleError')" styleClass="w-full mb-3" />
      }
      <div #host class="flex justify-content-center" style="min-height: 40px"></div>
    </div>
  `,
})
export class GoogleSigninComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private theme = inject(ThemeService);

  private host = viewChild<ElementRef<HTMLDivElement>>('host');
  private gisReady = signal(false);

  error = signal(false);

  constructor() {
    loadGis().then(
      () => this.gisReady.set(true),
      () => this.error.set(true),
    );
    // (Re-)render Google's button whenever the host div appears or the
    // language/theme changes — GIS bakes both into the rendered iframe.
    effect(() => {
      const locale = this.lang.current();
      const dark = this.theme.current() === 'dark';
      const host = this.host()?.nativeElement;
      if (!this.gisReady() || !host || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => this.onCredential(response.credential),
      });
      host.replaceChildren();
      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        width: Math.min(400, host.offsetWidth || 320),
        locale,
      });
    });
  }

  private onCredential(credential: string): void {
    this.error.set(false);
    this.auth.googleLogin(credential).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => this.error.set(true),
    });
  }
}
