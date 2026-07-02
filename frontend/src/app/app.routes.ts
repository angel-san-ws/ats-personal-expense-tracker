import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses').then((m) => m.ExpensesComponent),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./features/payments/payments').then((m) => m.PaymentsComponent),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./features/import/import').then((m) => m.ImportComponent),
      },
      {
        path: 'recurring',
        loadComponent: () =>
          import('./features/recurring/recurring').then(
            (m) => m.RecurringComponent,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories').then(
            (m) => m.CategoriesComponent,
          ),
      },
      {
        path: 'concepts',
        loadComponent: () =>
          import('./features/concepts/concepts').then((m) => m.ConceptsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
