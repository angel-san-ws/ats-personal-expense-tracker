import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="auth-shell" *transloco="let t">
      <p-card styleClass="auth-card">
        <div class="text-center mb-4">
          <img src="logo.png" alt="" style="height: 4rem; width: 4rem" />
          <h2 class="mt-2 mb-1">{{ t('auth.loginTitle') }}</h2>
          <p class="m-0 text-color-secondary">{{ t('auth.loginSubtitle') }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-column gap-3">
          <div class="flex flex-column gap-1">
            <label for="email">{{ t('auth.email') }}</label>
            <input
              pInputText
              id="email"
              type="email"
              formControlName="email"
              class="w-full"
              autocomplete="email"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="password">{{ t('auth.password') }}</label>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <p-message severity="error" [text]="t('auth.loginError')" />
          }

          <p-button
            type="submit"
            [label]="t('auth.login')"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
            styleClass="w-full"
          />
        </form>

        <div class="text-center mt-3 text-color-secondary">
          {{ t('auth.noAccount') }}
          <a routerLink="/register" class="font-medium" style="color: var(--p-primary-color)">
            {{ t('auth.createOne') }}
          </a>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
