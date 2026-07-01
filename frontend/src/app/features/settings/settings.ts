import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { UsersService } from '../../core/services/users.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AppLanguage } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    InputTextModule,
    SelectModule,
    PasswordModule,
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
              </div>
              <div class="flex flex-column gap-1">
                <label>{{ t('settings.name') }}</label>
                <input pInputText [(ngModel)]="name" class="w-full" />
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
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  name = '';
  language: AppLanguage = 'en';
  currency = 'GTQ';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  savingProfile = signal(false);
  savingPrefs = signal(false);
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

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.name = user.name;
      this.language = user.language;
      this.currency = user.currency;
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
      this.newPassword.length >= 6 &&
      this.newPassword === this.confirmPassword
    );
  }

  saveProfile(): void {
    this.savingProfile.set(true);
    this.users.updateProfile(this.name.trim()).subscribe({
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
      .updateSettings({ language: this.language, currency: this.currency })
      .subscribe({
        next: (user) => {
          this.auth.setUser(user);
          this.lang.use(this.language);
          this.savingPrefs.set(false);
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('settings.preferencesSaved'),
          });
        },
        error: () => this.savingPrefs.set(false),
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
