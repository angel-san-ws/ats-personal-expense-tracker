import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { AvatarModule } from 'primeng/avatar';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/i18n/language.service';
import { ThemeService } from '../core/theme.service';
import { UsersService } from '../core/services/users.service';
import { RecurringExpensesService } from '../core/services/recurring-expenses.service';
import { BudgetAlertService } from '../core/services/budget-alert.service';
import { AppLanguage, AppTheme } from '../core/models';

interface NavLink {
  label: string;
  icon: string;
  path: string;
  /** Attention counter (e.g. over-budget categories); omitted = no badge. */
  badge?: string;
}

@Component({
  selector: 'app-main-layout',
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoDirective,
    ButtonModule,
    DrawerModule,
    MenuModule,
    SelectModule,
    AvatarModule,
  ],
  template: `
    <div class="app-shell" *transloco="let t">
      <header
        class="flex align-items-center gap-2 px-3 py-2 surface-card shadow-2"
        style="position: sticky; top: 0; z-index: 100;"
      >
        <p-button
          class="lg:hidden flex-shrink-0"
          [text]="true"
          [rounded]="true"
          icon="pi pi-bars"
          (onClick)="menuOpen.set(true)"
          [ariaLabel]="t('nav.menu')"
        />

        <div class="flex align-items-center gap-2 mr-2 overflow-hidden">
          <img src="logo.png" alt="" class="flex-shrink-0" style="height: 1.75rem; width: 1.75rem" />
          <span class="font-bold text-lg white-space-nowrap overflow-hidden text-overflow-ellipsis">
            {{ t('app.title') }}
          </span>
        </div>

        <nav class="hidden lg:flex align-items-center gap-1 flex-wrap flex-1">
          @for (link of navLinks(); track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive
              #rla="routerLinkActive"
              class="no-underline"
            >
              <p-button
                [label]="t(link.label)"
                [icon]="link.icon"
                [text]="!rla.isActive"
                [outlined]="rla.isActive"
                size="small"
                [badge]="link.badge"
                badgeSeverity="danger"
              />
            </a>
          }
        </nav>
        <div class="flex-1 lg:hidden"></div>

        <p-button
          class="flex-shrink-0"
          [text]="true"
          [rounded]="true"
          [icon]="theme.current() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
          (onClick)="toggleTheme()"
          [ariaLabel]="t('nav.toggleTheme')"
        />

        <p-select
          class="hidden md:inline-flex flex-shrink-0"
          [options]="languages"
          [ngModel]="lang.current()"
          (onChange)="onLanguageChange($event.value)"
          optionLabel="label"
          optionValue="value"
          styleClass="w-8rem"
        />

        <p-button
          class="flex-shrink-0"
          [text]="true"
          (onClick)="userMenu.toggle($event)"
          styleClass="p-1"
        >
          <p-avatar
            [label]="initials()"
            shape="circle"
            styleClass="bg-primary"
          />
        </p-button>
        <p-menu #userMenu [model]="userMenuItems()" [popup]="true" appendTo="body" />
      </header>

      @if (showVerifyBanner()) {
        <div
          class="flex align-items-center justify-content-center flex-wrap gap-2 px-3 py-2 text-sm"
          style="background: var(--p-message-warn-background, var(--p-yellow-100)); color: var(--p-message-warn-color, var(--p-yellow-900)); border-bottom: 1px solid var(--p-message-warn-border-color, transparent);"
        >
          <i class="pi pi-envelope"></i>
          @if (verifyEmailState() === 'sent') {
            <span class="font-medium">{{ t('verifyEmail.sent') }}</span>
          } @else if (verifyEmailState() === 'failed') {
            <span>{{ t('verifyEmail.sendFailed') }}</span>
          } @else {
            <span>{{ t('verifyEmail.banner') }}</span>
          }
          @if (verifyEmailState() !== 'sent') {
            <p-button
              [label]="t('verifyEmail.resend')"
              size="small"
              [text]="true"
              [loading]="verifyEmailState() === 'sending'"
              (onClick)="resendVerification()"
            />
          }
        </div>
      }

      <p-drawer
        [visible]="menuOpen()"
        (visibleChange)="menuOpen.set($event)"
        [modal]="true"
        styleClass="w-18rem"
      >
        <ng-template #header>
          <div class="flex align-items-center gap-2">
            <img src="logo.png" alt="" style="height: 1.75rem; width: 1.75rem" />
            <span class="font-bold">{{ t('app.title') }}</span>
          </div>
        </ng-template>

        <nav class="flex flex-column gap-1">
          @for (link of navLinks(); track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive
              #rla="routerLinkActive"
              class="no-underline"
              (click)="menuOpen.set(false)"
            >
              <p-button
                [label]="t(link.label)"
                [icon]="link.icon"
                [text]="!rla.isActive"
                [outlined]="rla.isActive"
                styleClass="w-full justify-content-start"
                [badge]="link.badge"
                badgeSeverity="danger"
              />
            </a>
          }
        </nav>

        <div class="mt-4 md:hidden">
          <p-select
            [options]="languages"
            [ngModel]="lang.current()"
            (onChange)="onLanguageChange($event.value)"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
          />
        </div>
      </p-drawer>

      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  standalone: true,
})
export class MainLayoutComponent implements OnInit {
  private auth = inject(AuthService);
  lang = inject(LanguageService);
  theme = inject(ThemeService);
  private users = inject(UsersService);
  private transloco = inject(TranslocoService);
  private recurring = inject(RecurringExpensesService);
  private budgetAlerts = inject(BudgetAlertService);

  menuOpen = signal(false);

  verifyEmailState = signal<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  showVerifyBanner = computed(() => this.auth.user()?.emailVerified === false);

  languages = [
    { label: 'English', value: 'en' as AppLanguage },
    { label: 'Español', value: 'es' as AppLanguage },
  ];

  navLinks = computed<NavLink[]>(() => {
    const overBudget = this.budgetAlerts.overCount();
    return [
      { label: 'nav.dashboard', icon: 'pi pi-chart-bar', path: '/dashboard' },
      { label: 'nav.expenses', icon: 'pi pi-list', path: '/expenses' },
      { label: 'nav.payments', icon: 'pi pi-credit-card', path: '/payments' },
      {
        label: 'nav.budgets',
        icon: 'pi pi-gauge',
        path: '/budgets',
        badge: overBudget > 0 ? String(overBudget) : undefined,
      },
      { label: 'nav.recurring', icon: 'pi pi-sync', path: '/recurring' },
      { label: 'nav.import', icon: 'pi pi-upload', path: '/import' },
      { label: 'nav.accounts', icon: 'pi pi-wallet', path: '/accounts' },
      { label: 'nav.categories', icon: 'pi pi-tags', path: '/categories' },
      { label: 'nav.concepts', icon: 'pi pi-sitemap', path: '/concepts' },
    ];
  });

  ngOnInit(): void {
    // Lazy catch-up: generate any recurring expenses due since the last visit.
    this.recurring.generate().subscribe({ error: () => {} });
    // Over-budget check: toast once after login, badge on the Budgets link.
    this.budgetAlerts.checkOnLogin();
  }

  initials = computed(() => {
    const name = this.auth.user()?.name ?? '?';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n.charAt(0).toUpperCase())
      .join('');
  });

  userMenuItems = computed<MenuItem[]>(() => {
    // Depend on the active language so labels re-translate on switch.
    this.lang.current();
    const t = (k: string) => this.transloco.translate(k);
    return [
      {
        label: this.auth.user()?.name ?? '',
        items: [
          {
            label: t('nav.settings'),
            icon: 'pi pi-cog',
            routerLink: '/settings',
          },
          {
            label: t('nav.logout'),
            icon: 'pi pi-sign-out',
            command: () => this.auth.logout(),
          },
        ],
      },
    ];
  });

  resendVerification(): void {
    this.verifyEmailState.set('sending');
    this.auth.resendVerification().subscribe({
      next: (res) => {
        if (res.alreadyVerified) {
          // e.g. verified in another tab — refresh the user to drop the banner.
          this.auth.loadMe().subscribe({ error: () => {} });
          return;
        }
        this.verifyEmailState.set(res.sent ? 'sent' : 'failed');
      },
      error: () => this.verifyEmailState.set('failed'),
    });
  }

  onLanguageChange(value: AppLanguage): void {
    this.lang.use(value);
    // Persist to the user's profile (best effort).
    this.users.updateSettings({ language: value }).subscribe({
      next: (user) => this.auth.setUser(user),
      error: () => {},
    });
  }

  toggleTheme(): void {
    const next: AppTheme = this.theme.current() === 'dark' ? 'light' : 'dark';
    this.theme.use(next);
    // Persist to the user's profile (best effort).
    this.users.updateSettings({ theme: next }).subscribe({
      next: (user) => this.auth.setUser(user),
      error: () => {},
    });
  }
}
