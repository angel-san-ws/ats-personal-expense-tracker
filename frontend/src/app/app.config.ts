import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService, ConfirmationService } from 'primeng/api';
import { catchError, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    MessageService,
    ConfirmationService,
    providePrimeNG({
      ripple: true,
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'es'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: false,
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const lang = inject(LanguageService);
      const theme = inject(ThemeService);
      const auth = inject(AuthService);
      lang.init();
      theme.init();
      if (auth.token) {
        return auth.loadMe().pipe(
          catchError((err: unknown) => {
            // Expired/invalid token: drop it so guestGuard doesn't bounce
            // /login back to /dashboard. Network errors (backend still
            // starting) keep the token; the guards still require a loaded
            // session, so the user lands on /login either way.
            if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
              auth.clearStaleToken();
            }
            return of(null);
          }),
        );
      }
      return of(null);
    }),
  ],
};
