import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

function matchPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
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
          <i class="pi pi-wallet text-5xl" style="color: var(--p-primary-color)"></i>
          <h2 class="mt-2 mb-1">{{ t('auth.registerTitle') }}</h2>
          <p class="m-0 text-color-secondary">{{ t('auth.registerSubtitle') }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-column gap-3">
          <div class="flex flex-column gap-1">
            <label for="name">{{ t('auth.name') }}</label>
            <input pInputText id="name" formControlName="name" class="w-full" />
          </div>

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
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="new-password"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="confirmPassword">{{ t('auth.confirmPassword') }}</label>
            <p-password
              inputId="confirmPassword"
              formControlName="confirmPassword"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="new-password"
            />
          </div>

          @if (form.hasError('mismatch') && form.get('confirmPassword')?.dirty) {
            <p-message severity="warn" [text]="t('auth.passwordMismatch')" />
          }
          @if (error()) {
            <p-message severity="error" [text]="t('auth.registerError')" />
          }

          <p-button
            type="submit"
            [label]="t('auth.register')"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
            styleClass="w-full"
          />
        </form>

        <div class="text-center mt-3 text-color-secondary">
          {{ t('auth.haveAccount') }}
          <a routerLink="/login" class="font-medium" style="color: var(--p-primary-color)">
            {{ t('auth.signInHere') }}
          </a>
        </div>
      </p-card>
    </div>
  `,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal(false);

  form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchPasswords },
  );

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);
    const { email, name, password } = this.form.getRawValue();
    this.auth.register(email, name, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
