import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

/** Request a password-reset email. The success state is intentionally the
 * same whether or not the address is registered. */
@Component({
  selector: 'app-forgot-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="auth-shell" *transloco="let t">
      <p-card styleClass="auth-card">
        @if (sent()) {
          <div class="text-center flex flex-column align-items-center gap-3 py-3">
            <i class="pi pi-envelope text-primary" style="font-size: 3rem"></i>
            <h2 class="m-0">{{ t('passwordReset.sentTitle') }}</h2>
            <p class="m-0 text-color-secondary">{{ t('passwordReset.sentBody') }}</p>
            <a routerLink="/login" class="no-underline">
              <p-button [label]="t('passwordReset.backToLogin')" [outlined]="true" />
            </a>
          </div>
        } @else {
          <div class="text-center mb-4">
            <img src="logo.png" alt="" style="height: 4rem; width: 4rem" />
            <h2 class="mt-2 mb-1">{{ t('passwordReset.requestTitle') }}</h2>
            <p class="m-0 text-color-secondary">{{ t('passwordReset.requestSubtitle') }}</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-column gap-3">
            <div class="flex flex-column gap-1">
              <label for="email">{{ t('auth.email') }}</label>
              <input
                pInputText
                id="email"
                type="email"
                name="email"
                formControlName="email"
                class="w-full"
                autocomplete="username"
              />
            </div>

            @if (error()) {
              <p-message severity="error" [text]="t('passwordReset.sendError')" />
            }

            <p-button
              type="submit"
              [label]="t('passwordReset.sendLink')"
              [loading]="loading()"
              [disabled]="form.invalid || loading()"
              styleClass="w-full"
            />
          </form>

          <div class="text-center mt-3">
            <a routerLink="/login" class="font-medium" style="color: var(--p-primary-color)">
              {{ t('passwordReset.backToLogin') }}
            </a>
          </div>
        }
      </p-card>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal(false);
  sent = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.sent.set(true),
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
