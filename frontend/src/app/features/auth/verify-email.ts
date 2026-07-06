import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../core/auth/auth.service';

/** Landing page for the verification link emailed on registration. */
@Component({
  selector: 'app-verify-email',
  imports: [
    RouterLink,
    TranslocoDirective,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="auth-shell" *transloco="let t">
      <p-card styleClass="auth-card">
        <div class="text-center flex flex-column align-items-center gap-3 py-3">
          @switch (state()) {
            @case ('verifying') {
              <p-progressSpinner styleClass="w-4rem h-4rem" />
              <p class="m-0 text-color-secondary">{{ t('verifyEmail.verifying') }}</p>
            }
            @case ('success') {
              <i class="pi pi-check-circle text-green-500" style="font-size: 3rem"></i>
              <h2 class="m-0">{{ t('verifyEmail.successTitle') }}</h2>
              <p class="m-0 text-color-secondary">{{ t('verifyEmail.successBody') }}</p>
              <a [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/login'" class="no-underline">
                <p-button
                  [label]="t(auth.isAuthenticated() ? 'verifyEmail.goToApp' : 'verifyEmail.goToLogin')"
                />
              </a>
            }
            @case ('error') {
              <i class="pi pi-times-circle text-red-500" style="font-size: 3rem"></i>
              <h2 class="m-0">{{ t('verifyEmail.errorTitle') }}</h2>
              <p class="m-0 text-color-secondary">{{ t('verifyEmail.errorBody') }}</p>
              <a [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/login'" class="no-underline">
                <p-button
                  [label]="t(auth.isAuthenticated() ? 'verifyEmail.goToApp' : 'verifyEmail.goToLogin')"
                  [outlined]="true"
                />
              </a>
            }
          }
        </div>
      </p-card>
    </div>
  `,
})
export class VerifyEmailComponent implements OnInit {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  state = signal<'verifying' | 'success' | 'error'>('verifying');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.state.set('success');
        // If verified while logged in, refresh the user so the banner clears.
        if (this.auth.isAuthenticated()) {
          this.auth.loadMe().subscribe({ error: () => {} });
        }
      },
      error: () => this.state.set('error'),
    });
  }
}
