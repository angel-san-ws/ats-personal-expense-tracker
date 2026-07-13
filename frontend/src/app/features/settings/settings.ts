import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { PASSWORD_RULES, isStrongPassword } from '../../core/auth/password-policy';
import { UsersService } from '../../core/services/users.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme.service';
import { AppLanguage, AppTheme } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    InputTextModule,
    SelectModule,
    PasswordModule,
    ToggleSwitchModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header">
        <h1>{{ t('settings.title') }}</h1>
      </div>

      <div class="grid">
        <!-- Profile -->
        <div class="col-12 lg:col-6">
          <p-card [header]="t('settings.profile')">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.email') }}</label>
                <input pInputText [value]="auth.user()?.email" disabled class="w-full" />
                @if (auth.user()?.emailVerified) {
                  <small class="flex align-items-center gap-1" style="color: var(--p-green-500)">
                    <i class="pi pi-verified"></i>
                    {{ t('settings.emailVerified') }}
                  </small>
                } @else {
                  <small class="flex align-items-center gap-1 text-color-secondary">
                    <i class="pi pi-exclamation-circle"></i>
                    {{ t('settings.emailNotVerified') }}
                  </small>
                }
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.name') }}</label>
                <input pInputText [(ngModel)]="name" class="w-full" />
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.mobilePhone') }}</label>
                <input
                  pInputText
                  type="tel"
                  [(ngModel)]="mobilePhone"
                  [placeholder]="t('settings.mobilePhonePlaceholder')"
                  class="w-full"
                />
                <small class="text-color-secondary">{{ t('settings.mobilePhoneHint') }}</small>
              </div>
              <div>
                <p-button
                  [label]="t('settings.saveProfile')"
                  icon="pi pi-save"
                  [loading]="savingProfile()"
                  (onClick)="saveProfile()"
                />
              </div>
            </div>
          </p-card>
        </div>

        <!-- Preferences -->
        <div class="col-12 lg:col-6">
          <p-card [header]="t('settings.preferences')">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.language') }}</label>
                <p-select
                  [(ngModel)]="language"
                  [options]="languageOptions()"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                />
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.theme') }}</label>
                <p-select
                  [(ngModel)]="theme"
                  [options]="themeOptions()"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                />
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.currency') }}</label>
                <p-select
                  [(ngModel)]="currency"
                  [options]="currencyOptions"
                  optionLabel="label"
                  optionValue="value"
                  [editable]="true"
                  styleClass="w-full"
                />
              </div>
              <div>
                <p-button
                  [label]="t('settings.savePreferences')"
                  icon="pi pi-save"
                  [loading]="savingPrefs()"
                  (onClick)="savePreferences()"
                />
              </div>
            </div>
          </p-card>
        </div>

        <!-- Notifications -->
        <div class="col-12 lg:col-6">
          <p-card [header]="t('settings.notifications')">
            <div class="flex flex-column gap-3">
              <div class="flex align-items-center justify-content-between gap-3">
                <div class="flex flex-column gap-1">
                  <label>{{ t('settings.notifyPaymentDue') }}</label>
                  <small class="text-color-secondary">{{ t('settings.notifyPaymentDueHint') }}</small>
                </div>
                <p-toggleswitch [(ngModel)]="notifyPaymentDue" />
              </div>
              <div class="flex align-items-center justify-content-between gap-3">
                <div class="flex flex-column gap-1">
                  <label>{{ t('settings.notifyBudgetOverspend') }}</label>
                  <small class="text-color-secondary">{{ t('settings.notifyBudgetOverspendHint') }}</small>
                </div>
                <p-toggleswitch [(ngModel)]="notifyBudgetOverspend" />
              </div>
              <div>
                <p-button
                  [label]="t('settings.saveNotifications')"
                  icon="pi pi-save"
                  [loading]="savingNotifications()"
                  (onClick)="saveNotifications()"
                />
              </div>
            </div>
          </p-card>
        </div>

        <!-- Security -->
        <div class="col-12 lg:col-6">
          <p-card [header]="t('settings.security')">
            <div class="flex flex-column gap-3">
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.currentPassword') }}</label>
                <p-password [(ngModel)]="currentPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.newPassword') }}</label>
                <p-password [(ngModel)]="newPassword" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
                <ul class="m-0 mt-1 p-0 list-none flex flex-column gap-1 text-sm">
                  <li class="text-color-secondary">{{ t('auth.passwordRequirements') }}</li>
                  @for (rule of passwordRules; track rule.key) {
                    <li
                      class="flex align-items-center gap-2"
                      [style.color]="rule.test(newPassword) ? 'var(--p-green-500)' : 'var(--p-text-muted-color)'"
                    >
                      <i class="pi" [class.pi-check-circle]="rule.test(newPassword)" [class.pi-circle]="!rule.test(newPassword)"></i>
                      {{ t(rule.labelKey) }}
                    </li>
                  }
                </ul>
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.confirmPassword') }}</label>
                <p-password [(ngModel)]="confirmPassword" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" />
              </div>
              @if (passwordMismatch()) {
                <p-message severity="warn" [text]="t('auth.passwordMismatch')" />
              }
              <div>
                <p-button
                  [label]="t('settings.changePassword')"
                  icon="pi pi-lock"
                  [loading]="savingPassword()"
                  [disabled]="!canChangePassword()"
                  (onClick)="changePassword()"
                />
              </div>
            </div>
          </p-card>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  auth = inject(AuthService);
  private users = inject(UsersService);
  private lang = inject(LanguageService);
  private themes = inject(ThemeService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  name = '';
  mobilePhone = '';
  language: AppLanguage = 'en';
  currency = 'GTQ';
  theme: AppTheme = 'light';
  notifyPaymentDue = false;
  notifyBudgetOverspend = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  passwordRules = PASSWORD_RULES;

  savingProfile = signal(false);
  savingPrefs = signal(false);
  savingNotifications = signal(false);
  savingPassword = signal(false);

  currencyOptions = [
    { label: 'GTQ — Guatemalan Quetzal', value: 'GTQ' },
    { label: 'USD — US Dollar', value: 'USD' },
    { label: 'EUR — Euro', value: 'EUR' },
    { label: 'MXN — Mexican Peso', value: 'MXN' },
  ];

  languageOptions = signal([
    { label: this.transloco.translate('settings.english'), value: 'en' },
    { label: this.transloco.translate('settings.spanish'), value: 'es' },
  ]);

  themeOptions = signal([
    { label: this.transloco.translate('settings.light'), value: 'light' },
    { label: this.transloco.translate('settings.dark'), value: 'dark' },
  ]);

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.name = user.name;
      this.mobilePhone = user.mobilePhone ?? '';
      this.language = user.language;
      this.currency = user.currency;
      this.theme = user.theme;
      this.notifyPaymentDue = user.notifyPaymentDue;
      this.notifyBudgetOverspend = user.notifyBudgetOverspend;
    }
  }

  passwordMismatch(): boolean {
    return (
      !!this.confirmPassword && this.newPassword !== this.confirmPassword
    );
  }

  canChangePassword(): boolean {
    return (
      !!this.currentPassword &&
      isStrongPassword(this.newPassword) &&
      this.newPassword === this.confirmPassword
    );
  }

  saveProfile(): void {
    this.savingProfile.set(true);
    this.users
      .updateProfile(this.name.trim(), this.mobilePhone.trim())
      .subscribe({
      next: (user) => {
        this.auth.setUser(user);
        this.savingProfile.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('settings.profileSaved'),
        });
      },
      error: () => this.savingProfile.set(false),
    });
  }

  savePreferences(): void {
    this.savingPrefs.set(true);
    this.users
      .updateSettings({
        language: this.language,
        currency: this.currency,
        theme: this.theme,
      })
      .subscribe({
        next: (user) => {
          this.auth.setUser(user);
          this.lang.use(this.language);
          this.themes.use(this.theme);
          this.savingPrefs.set(false);
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('settings.preferencesSaved'),
          });
        },
        error: () => this.savingPrefs.set(false),
      });
  }

  saveNotifications(): void {
    this.savingNotifications.set(true);
    this.users
      .updateSettings({
        notifyPaymentDue: this.notifyPaymentDue,
        notifyBudgetOverspend: this.notifyBudgetOverspend,
      })
      .subscribe({
        next: (user) => {
          this.auth.setUser(user);
          this.savingNotifications.set(false);
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('settings.notificationsSaved'),
          });
        },
        error: () => this.savingNotifications.set(false),
      });
  }

  changePassword(): void {
    if (!this.canChangePassword()) return;
    this.savingPassword.set(true);
    this.users.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('settings.passwordChanged'),
        });
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('settings.passwordError'),
          detail: err?.error?.message,
        });
      },
    });
  }
}
