import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';
import {
  PASSWORD_RULES,
  PasswordRule,
  strongPasswordValidator,
} from '../../core/auth/password-policy';

function matchPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

/** Landing page for the password-reset link emailed by "Forgot password". */
@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    CardModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div class="auth-shell" *transloco="let t">
      <p-card styleClass="auth-card">
        @switch (state()) {
          @case ('form') {
            <div class="text-center mb-4">
              <img src="logo.png" alt="" style="height: 4rem; width: 4rem" />
              <h2 class="mt-2 mb-1">{{ t('passwordReset.resetTitle') }}</h2>
              <p class="m-0 text-color-secondary">{{ t('passwordReset.resetSubtitle') }}</p>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label for="password">{{ t('auth.password') }}</label>
                <p-password
                  inputId="password"
                  name="new-password"
                  formControlName="password"
                  [feedback]="false"
                  [toggleMask]="true"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                  autocomplete="new-password"
                />
                <ul class="m-0 mt-1 p-0 list-none flex flex-column gap-1 text-sm">
                  <li class="text-color-secondary">{{ t('auth.passwordRequirements') }}</li>
                  @for (rule of passwordRules; track rule.key) {
                    <li
                      class="flex align-items-center gap-2"
                      [style.color]="ruleOk(rule) ? 'var(--p-green-500)' : 'var(--p-text-muted-color)'"
                    >
                      <i class="pi" [class.pi-check-circle]="ruleOk(rule)" [class.pi-circle]="!ruleOk(rule)"></i>
                      {{ t(rule.labelKey) }}
                    </li>
                  }
                </ul>
              </div>

              <div class="flex flex-column gap-1">
                <label for="confirmPassword">{{ t('auth.confirmPassword') }}</label>
                <p-password
                  inputId="confirmPassword"
                  name="confirm-password"
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

              <p-button
                type="submit"
                [label]="t('passwordReset.reset')"
                [loading]="loading()"
                [disabled]="form.invalid || loading()"
                styleClass="w-full"
              />
            </form>
          }
          @case ('success') {
            <div class="text-center flex flex-column align-items-center gap-3 py-3">
              <i class="pi pi-check-circle text-green-500" style="font-size: 3rem"></i>
              <h2 class="m-0">{{ t('passwordReset.successTitle') }}</h2>
              <p class="m-0 text-color-secondary">{{ t('passwordReset.successBody') }}</p>
              <a routerLink="/login" class="no-underline">
                <p-button [label]="t('passwordReset.backToLogin')" />
              </a>
            </div>
          }
          @case ('error') {
            <div class="text-center flex flex-column align-items-center gap-3 py-3">
              <i class="pi pi-times-circle text-red-500" style="font-size: 3rem"></i>
              <h2 class="m-0">{{ t('passwordReset.errorTitle') }}</h2>
              <p class="m-0 text-color-secondary">{{ t('passwordReset.errorBody') }}</p>
              <a routerLink="/forgot-password" class="no-underline">
                <p-button [label]="t('passwordReset.requestNew')" [outlined]="true" />
              </a>
            </div>
          }
        }
      </p-card>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  state = signal<'form' | 'success' | 'error'>('form');
  loading = signal(false);

  passwordRules = PASSWORD_RULES;

  private token = '';

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchPasswords },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.state.set('error');
  }

  ruleOk(rule: PasswordRule): boolean {
    return rule.test(this.form.controls.password.value ?? '');
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.state.set('success'),
      // Any failure here means the token is bad — a new link is the only fix.
      error: () => this.state.set('error'),
    });
  }
}
