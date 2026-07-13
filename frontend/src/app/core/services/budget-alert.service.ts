import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';
import { BudgetsService } from './budgets.service';
import { BudgetStatus } from '../models';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Watches the current month's budget status: drives the over-budget badge on
 * the Budgets nav link and shows a one-time toast after login when any
 * category (or the overall budget) has crossed its limit.
 */
@Injectable({ providedIn: 'root' })
export class BudgetAlertService {
  private budgets = inject(BudgetsService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  /** Budgets over their effective limit this month (overall counts as one). */
  overCount = signal(0);

  /** The toast fires at most once per page load / login. */
  private alerted = false;

  /** Fetch the current month's status; toast on the first over-budget check. */
  checkOnLogin(): void {
    this.budgets.status().subscribe({
      next: (s) => this.apply(s, true),
      error: () => {},
    });
  }

  /** Refresh the badge from a status a page already loaded (no toast). */
  updateFrom(status: BudgetStatus): void {
    if (status.month === currentMonth()) this.apply(status, false);
  }

  private apply(status: BudgetStatus, toast: boolean): void {
    const overCategories = status.categories
      .filter((c) => c.effectiveAmount !== null && c.spent > c.effectiveAmount)
      .map((c) => c.categoryName);
    const overallOver =
      status.overall.effectiveAmount !== null &&
      status.overall.spent > status.overall.effectiveAmount;
    this.overCount.set(overCategories.length + (overallOver ? 1 : 0));

    if (!toast || this.alerted || this.overCount() === 0) return;
    this.alerted = true;
    // This runs right at app start — wait for the translation file to load.
    this.transloco
      .selectTranslation()
      .pipe(take(1))
      .subscribe(() => {
        const names = overallOver
          ? [this.transloco.translate('budgets.overall'), ...overCategories]
          : overCategories;
        this.messages.add({
          severity: 'warn',
          summary: this.transloco.translate('budgets.alert.title'),
          detail: this.transloco.translate('budgets.alert.detail', {
            names: names.join(', '),
          }),
          life: 8000,
        });
      });
  }
}
