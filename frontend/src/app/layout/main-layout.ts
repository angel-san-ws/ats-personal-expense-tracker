import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { AvatarModule } from 'primeng/avatar';
import { MenuItem } from 'primeng/api';

import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/i18n/language.service';
import { UsersService } from '../core/services/users.service';
import { AppLanguage } from '../core/models';

interface NavLink {
  label: string;
  icon: string;
  path: string;
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
    MenuModule,
    SelectModule,
    AvatarModule,
  ],
  template: `
    <div class="app-shell" *transloco="let t">
      <header
        class="flex align-items-center gap-3 px-3 py-2 surface-card shadow-2"
        style="position: sticky; top: 0; z-index: 100;"
      >
        <div class="flex align-items-center gap-2 mr-2">
          <i class="pi pi-wallet text-2xl" style="color: var(--p-primary-color)"></i>
          <span class="font-bold text-lg white-space-nowrap">{{ t('app.title') }}</span>
        </div>

        <nav class="flex align-items-center gap-1 flex-wrap flex-1">
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
              />
            </a>
          }
        </nav>

        <p-select
          [options]="languages"
          [ngModel]="lang.current()"
          (onChange)="onLanguageChange($event.value)"
          optionLabel="label"
          optionValue="value"
          styleClass="w-8rem"
        />

        <p-button
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

      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  standalone: true,
})
export class MainLayoutComponent {
  private auth = inject(AuthService);
  lang = inject(LanguageService);
  private users = inject(UsersService);
  private transloco = inject(TranslocoService);

  languages = [
    { label: 'English', value: 'en' as AppLanguage },
    { label: 'Español', value: 'es' as AppLanguage },
  ];

  navLinks = signal<NavLink[]>([
    { label: 'nav.dashboard', icon: 'pi pi-chart-bar', path: '/dashboard' },
    { label: 'nav.expenses', icon: 'pi pi-list', path: '/expenses' },
    { label: 'nav.payments', icon: 'pi pi-credit-card', path: '/payments' },
    { label: 'nav.import', icon: 'pi pi-upload', path: '/import' },
    { label: 'nav.categories', icon: 'pi pi-tags', path: '/categories' },
    { label: 'nav.concepts', icon: 'pi pi-sitemap', path: '/concepts' },
  ]);

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

  onLanguageChange(value: AppLanguage): void {
    this.lang.use(value);
    // Persist to the user's profile (best effort).
    this.users.updateSettings({ language: value }).subscribe({
      next: (user) => this.auth.setUser(user),
      error: () => {},
    });
  }
}
