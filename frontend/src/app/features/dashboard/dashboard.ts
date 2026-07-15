import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { FilterBarComponent } from '../shared/filter-bar';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { projectMonthEnd, projectionPct } from '../../core/projection.util';
import { ExpensesService } from '../../core/services/expenses.service';
import { BudgetsService } from '../../core/services/budgets.service';
import { BudgetAlertService } from '../../core/services/budget-alert.service';
import { ImportService } from '../../core/services/import.service';
import { ThemeService } from '../../core/theme.service';
import {
  BudgetStatus,
  DashboardSummary,
  ExpenseQuery,
  PaymentReminder,
} from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [
    TranslocoDirective,
    CardModule,
    ChartModule,
    MessageModule,
    ButtonModule,
    TagModule,
    FilterBarComponent,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header">
        <h1>{{ t('dashboard.title') }}</h1>
      </div>

      <app-filter-bar
        persistKey="dashboard"
        [allowSave]="true"
        [collapsible]="true"
        (filtersChange)="onFilters($event)"
      />

      @if (reminders().length > 0) {
        <p-card styleClass="mb-3">
          <div class="font-medium mb-2">{{ t('dashboard.reminder.title') }}</div>
          <div class="flex flex-column gap-2">
            @for (r of reminders(); track r.accountId) {
              <div class="flex align-items-center justify-content-between flex-wrap gap-2">
                <span class="flex align-items-center gap-2">
                  <span class="color-swatch" [style.background]="r.accountColor || 'var(--p-content-border-color)'"></span>
                  <span class="font-medium">{{ r.accountName }}</span>
                  @switch (r.status) {
                    @case ('paid') {
                      <p-tag severity="success" [value]="t('dashboard.reminder.paid')" />
                    }
                    @case ('overdue') {
                      <p-tag severity="danger" [value]="t('dashboard.reminder.overdue', { days: -r.daysUntilDue })" />
                    }
                    @case ('dueSoon') {
                      <p-tag
                        severity="warn"
                        [value]="r.daysUntilDue === 0 ? t('dashboard.reminder.dueToday') : t('dashboard.reminder.dueIn', { days: r.daysUntilDue })"
                      />
                    }
                    @case ('upcoming') {
                      <p-tag severity="info" [value]="t('dashboard.reminder.dueIn', { days: r.daysUntilDue })" />
                    }
                  }
                </span>
                <span class="flex align-items-center gap-3 flex-wrap">
                  <span class="text-sm text-color-secondary">
                    {{ t('dashboard.reminder.dueDate') }}: {{ r.dueDate }}
                  </span>
                  @if (r.status === 'paid' && r.paidAmount !== null) {
                    <span class="text-sm">
                      {{ t('dashboard.reminder.paidAmount') }}: {{ r.paidAmount | atsCurrency: r.paidCurrency }}
                    </span>
                  } @else if (r.minimumPayment !== null) {
                    <span class="text-sm">
                      {{ t('dashboard.reminder.minPayment') }}:
                      {{ r.minimumPayment | atsCurrency }}
                    </span>
                  }
                  <p-button
                    size="small"
                    [text]="true"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    [label]="t('dashboard.reminder.viewPayments')"
                    (onClick)="goToPayments(r.accountId)"
                  />
                  <p-button
                    size="small"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    icon="pi pi-times"
                    [ariaLabel]="t('dashboard.reminder.dismiss')"
                    (onClick)="dismissReminder(r)"
                  />
                </span>
              </div>
            }
          </div>
        </p-card>
      }

      @if (summary(); as s) {
        @if (s.unconvertedCount > 0) {
          <p-message severity="warn" styleClass="w-full mb-3">
            <div class="flex align-items-center justify-content-between flex-wrap gap-3 w-full">
              <span>{{ t('dashboard.unconverted', { count: s.unconvertedCount }) }}</span>
              <p-button
                size="small"
                severity="warn"
                [outlined]="true"
                [loading]="refreshingRates()"
                [label]="t('dashboard.updateRates')"
                (onClick)="refreshRates()"
              />
            </div>
          </p-message>
        }

        <div class="grid mb-2">
          <div class="col-12 md:col-6 lg:col-3">
            <p-card>
              <div class="kpi-label">{{ t('dashboard.totalSpend') }}</div>
              <div class="kpi-value">{{ s.totalValor | atsCurrency: s.baseCurrency }}</div>
              @if (hasConverted()) {
                <div class="text-sm text-color-secondary mt-1">
                  @for (ct of s.byCurrency; track ct.currency) {
                    <span class="mr-2">{{ ct.total | atsCurrency: ct.currency }}</span>
                  }
                </div>
              }
            </p-card>
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <p-card>
              <div class="kpi-label">{{ t('dashboard.transactions') }}</div>
              <div class="kpi-value">{{ s.count }}</div>
            </p-card>
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <p-card>
              <div class="kpi-label">{{ t('dashboard.avgTransaction') }}</div>
              <div class="kpi-value">{{ s.avgValor | atsCurrency: s.baseCurrency }}</div>
            </p-card>
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <p-card>
              <div class="kpi-label">{{ t('dashboard.topMerchant') }}</div>
              <div class="kpi-value text-base white-space-nowrap overflow-hidden text-overflow-ellipsis">
                {{ s.topMerchants[0]?.comercio ?? '—' }}
              </div>
            </p-card>
          </div>
        </div>

        @if (hasConverted()) {
          <div class="text-sm text-color-secondary mb-3">
            {{ t('dashboard.ratesFootnote', { currency: s.baseCurrency }) }}
          </div>
        }

        @if (budgetStatus(); as b) {
          @if (hasBudgets()) {
            <p-card styleClass="mb-3">
              <div class="flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <span class="font-medium">{{ t('dashboard.budgets') }}</span>
                <p-button
                  size="small"
                  [text]="true"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  [label]="t('dashboard.manageBudgets')"
                  (onClick)="goToBudgets()"
                />
              </div>
              <div class="flex flex-column gap-2">
                @if (b.overall.effectiveAmount !== null) {
                  <div class="flex align-items-center gap-2">
                    <span class="text-sm" style="min-width: 9rem">{{ t('budgets.overall') }}</span>
                    <div class="flex-1" style="background: var(--p-content-border-color); border-radius: 999px; height: 0.5rem; overflow: hidden;">
                      <div
                        style="height: 100%; border-radius: 999px"
                        [style.width.%]="cappedPct(b.overall.spent / b.overall.effectiveAmount * 100)"
                        [style.background]="barColor(b.overall.spent / b.overall.effectiveAmount * 100)"
                      ></div>
                    </div>
                    <span class="text-sm text-color-secondary white-space-nowrap">
                      {{ b.overall.spent | atsCurrency: b.baseCurrency }} / {{ b.overall.effectiveAmount | atsCurrency: b.baseCurrency }}
                    </span>
                  </div>
                  @if (overallProjection(); as p) {
                    <div
                      class="text-sm"
                      [class.text-color-secondary]="!p.over"
                      [style.color]="p.over ? '#ef4444' : undefined"
                    >
                      {{ t(p.over ? 'budgets.projectedOver' : 'budgets.projectedWithin', {
                        amount: (p.projected | atsCurrency: b.baseCurrency),
                        pct: p.pctLabel
                      }) }}
                    </div>
                  }
                }
                @for (row of topBudgets(); track row.categoryId) {
                  <div class="flex align-items-center gap-2">
                    <span class="text-sm flex align-items-center gap-2" style="min-width: 9rem">
                      <span class="color-swatch" [style.background]="row.color"></span>
                      {{ row.categoryName }}
                    </span>
                    <div class="flex-1" style="background: var(--p-content-border-color); border-radius: 999px; height: 0.5rem; overflow: hidden;">
                      <div
                        style="height: 100%; border-radius: 999px"
                        [style.width.%]="cappedPct(row.spent / row.effectiveAmount! * 100)"
                        [style.background]="barColor(row.spent / row.effectiveAmount! * 100)"
                      ></div>
                    </div>
                    <span class="text-sm text-color-secondary white-space-nowrap">
                      {{ row.spent | atsCurrency: b.baseCurrency }} / {{ row.effectiveAmount | atsCurrency: b.baseCurrency }}
                    </span>
                  </div>
                }
              </div>
            </p-card>
          }
        }

        @if (s.count === 0) {
          <p-card>
            <div class="text-center p-5 text-color-secondary">
              <i class="pi pi-inbox text-4xl mb-3 block"></i>
              {{ t('dashboard.noData') }}
            </div>
          </p-card>
        } @else {
          <div class="grid">
            <div class="col-12 lg:col-5">
              <p-card [header]="t('dashboard.byCategory')">
                <p-chart
                  type="doughnut"
                  [data]="categoryChart()"
                  [options]="pieOptions()"
                  height="20rem"
                  (onDataSelect)="onCategorySelect($event)"
                />
              </p-card>
            </div>
            <div class="col-12 lg:col-7">
              @if (useComparisonChart()) {
                <p-card [header]="t('dashboard.vsPrevious')">
                  <p-chart type="bar" [data]="comparisonChart()" [options]="barOptions()" height="20rem" />
                </p-card>
              } @else if (useCumulativeChart()) {
                <p-card [header]="t('dashboard.cumulative')">
                  <p-chart type="line" [data]="cumulativeChart()" [options]="barOptions()" height="20rem" />
                </p-card>
              } @else {
                <p-card [header]="t('dashboard.overTime')">
                  <p-chart type="bar" [data]="monthChart()" [options]="barOptions()" height="20rem" />
                </p-card>
              }
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('dashboard.byAccount')">
                <p-chart
                  type="bar"
                  [data]="accountChart()"
                  [options]="barOptions()"
                  height="18rem"
                  (onDataSelect)="onAccountSelect($event)"
                />
              </p-card>
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('dashboard.topMerchants')">
                <p-chart
                  type="bar"
                  [data]="merchantChart()"
                  [options]="horizontalBarOptions()"
                  height="18rem"
                  (onDataSelect)="onMerchantSelect($event)"
                />
              </p-card>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class DashboardComponent {
  private expenses = inject(ExpensesService);
  private budgets = inject(BudgetsService);
  private alerts = inject(BudgetAlertService);
  private imports = inject(ImportService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);
  private theme = inject(ThemeService);

  private query = signal<ExpenseQuery>({});
  summary = signal<DashboardSummary | null>(null);
  budgetStatus = signal<BudgetStatus | null>(null);
  /** Payment due-date reminders; independent of the dashboard filters. */
  reminders = signal<PaymentReminder[]>([]);
  refreshingRates = signal(false);

  constructor() {
    this.imports.paymentReminders().subscribe((r) => this.reminders.set(r));
  }

  hasBudgets = computed(() => {
    const b = this.budgetStatus();
    return (
      !!b &&
      (b.overall.effectiveAmount !== null ||
        b.categories.some((c) => c.effectiveAmount !== null))
    );
  });

  /**
   * Month-end projection vs the overall budget; null when no overall budget
   * is set or the projection is undefined (viewed month isn't the current
   * one, or it's too early in the month).
   */
  overallProjection = computed(() => {
    const b = this.budgetStatus();
    const limit = b?.overall.effectiveAmount ?? null;
    if (!b || limit === null) return null;
    const projected = projectMonthEnd(
      b.overall.spent,
      b.month,
      b.overall.recurringSpent,
    );
    if (projected === null) return null;
    const pct = projectionPct(projected, limit);
    if (pct === null) return null;
    const over = pct > 100;
    return { projected, over, pctLabel: Math.round(over ? pct - 100 : pct) };
  });

  /** The 3 budgeted categories closest to (or past) their limit. */
  topBudgets = computed(() => {
    const b = this.budgetStatus();
    if (!b) return [];
    return b.categories
      .filter((c) => c.effectiveAmount !== null && c.effectiveAmount > 0)
      .sort(
        (a, z) =>
          z.spent / z.effectiveAmount! - a.spent / a.effectiveAmount!,
      )
      .slice(0, 3);
  });

  /** Whether the filtered set contains foreign-currency (converted) amounts. */
  hasConverted = computed(() => {
    const s = this.summary();
    return !!s && s.byCurrency.some((ct) => ct.currency !== s.baseCurrency);
  });

  private lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private palette = [
    '#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
    '#ec4899', '#14b8a6', '#ef4444', '#64748b', '#84cc16',
  ];

  private hoverCursor = (event: { native: Event }, elements: unknown[]) => {
    const target = event.native?.target as HTMLElement | null;
    if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
  };

  /** Chart.js can't read CSS variables, so resolve the PrimeNG tokens per theme. */
  private chartColors = computed(() => {
    this.theme.current(); // recompute when the theme changes
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--p-text-color').trim(),
      muted: style.getPropertyValue('--p-text-muted-color').trim(),
      grid: style.getPropertyValue('--p-content-border-color').trim(),
    };
  });

  pieOptions = computed(() => ({
    plugins: {
      legend: { position: 'bottom', labels: { color: this.chartColors().text } },
    },
    maintainAspectRatio: false,
    onHover: this.hoverCursor,
  }));
  barOptions = computed(() => ({
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: this.chartColors().muted },
        grid: { color: this.chartColors().grid },
      },
      y: {
        beginAtZero: true,
        ticks: { color: this.chartColors().muted },
        grid: { color: this.chartColors().grid },
      },
    },
  }));
  horizontalBarOptions = computed(() => ({
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: this.chartColors().muted },
        grid: { color: this.chartColors().grid },
      },
      y: {
        ticks: { color: this.chartColors().muted },
        grid: { color: this.chartColors().grid },
      },
    },
    onHover: this.hoverCursor,
  }));

  categoryChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    return {
      labels: s.byCategory.map((c) => c.categoryName),
      datasets: [
        {
          data: s.byCategory.map((c) => c.total),
          backgroundColor: s.byCategory.map(
            (c, i) => c.color || this.palette[i % this.palette.length],
          ),
        },
      ],
    };
  });

  /**
   * A by-month chart is meaningless for ranges within a single month; for a
   * range longer than two weeks but at most a month (e.g. the "this month" /
   * "last month" presets), show cumulative daily spend instead. Weekday or
   * daily comparisons would mislead here: banks post weekend expenses on the
   * next Monday, but a posting-date spike is just a step in a running total.
   */
  useCumulativeChart = computed(() => {
    const days = this.rangeDays();
    return days !== null && days > 14 && days <= 31;
  });

  /**
   * For short ranges (≤ 2 weeks) the interesting question is "am I spending
   * more than usual?", so compare the window's total against the preceding
   * equal-length windows. Whole-window totals also absorb the bank's
   * weekend-to-Monday posting shift.
   */
  useComparisonChart = computed(() => {
    const days = this.rangeDays();
    return (
      days !== null && days <= 14 && (this.summary()?.previousPeriods.length ?? 0) > 0
    );
  });

  comparisonChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    const fmt = new Intl.DateTimeFormat(this.lang(), { day: 'numeric', month: 'short' });
    const labels = s.previousPeriods.map((p) => {
      const from = new Date(`${p.from}T00:00:00`);
      const to = new Date(`${p.to}T00:00:00`);
      return p.from === p.to ? fmt.format(from) : `${fmt.format(from)} – ${fmt.format(to)}`;
    });
    const last = s.previousPeriods.length - 1;
    return {
      labels,
      datasets: [
        {
          label: 'Total',
          data: s.previousPeriods.map((p) => p.total),
          // Muted for the preceding windows, accent for the selected one.
          backgroundColor: s.previousPeriods.map((_, i) =>
            i === last ? '#6366f1' : '#94a3b8',
          ),
        },
      ],
    };
  });

  private rangeDays = computed(() => {
    const q = this.query();
    if (!q.dateFrom || !q.dateTo) return null;
    const from = new Date(`${q.dateFrom}T00:00:00`);
    const to = new Date(`${q.dateTo}T00:00:00`);
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  });

  cumulativeChart = computed(() => {
    const s = this.summary();
    const q = this.query();
    if (!s || !q.dateFrom || !q.dateTo) return { labels: [], datasets: [] };
    const totalByDay = new Map(s.byDay.map((d) => [d.day, d.total]));
    const fmt = new Intl.DateTimeFormat(this.lang(), { day: 'numeric', month: 'short' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${q.dateTo}T00:00:00`);
    const last = end < today ? end : today;

    const labels: string[] = [];
    const data: number[] = [];
    let running = 0;
    for (let d = new Date(`${q.dateFrom}T00:00:00`); d <= last; d.setDate(d.getDate() + 1)) {
      const pad = (n: number) => String(n).padStart(2, '0');
      running += totalByDay.get(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`) ?? 0;
      labels.push(fmt.format(d));
      data.push(running);
    }
    return {
      labels,
      datasets: [
        {
          label: 'Total',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
        },
      ],
    };
  });

  monthChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    return {
      labels: s.byMonth.map((m) => m.month),
      datasets: [
        { label: 'Total', data: s.byMonth.map((m) => m.total), backgroundColor: '#6366f1' },
      ],
    };
  });

  accountChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    return {
      labels: s.byAccount.map((a) => a.name),
      datasets: [
        {
          label: 'Total',
          data: s.byAccount.map((a) => a.total),
          backgroundColor: s.byAccount.map((a) => a.color || '#3b82f6'),
        },
      ],
    };
  });

  merchantChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    return {
      labels: s.topMerchants.map((m) => m.comercio),
      datasets: [
        { label: 'Total', data: s.topMerchants.map((m) => m.total), backgroundColor: '#22c55e' },
      ],
    };
  });

  /** Drill down: open the expenses list filtered by the clicked slice's category. */
  onCategorySelect(event: { element?: { index: number } }): void {
    const cat = this.clickedItem(event, this.summary()?.byCategory);
    if (cat) this.drillDown({ category: cat.categoryId ?? 'none' });
  }

  /** Drill down: open the expenses list filtered by the clicked bar's account. */
  onAccountSelect(event: { element?: { index: number } }): void {
    const account = this.clickedItem(event, this.summary()?.byAccount);
    if (account?.accountId) this.drillDown({ account: account.accountId });
  }

  /** Drill down: open the expenses list filtered by the clicked bar's merchant. */
  onMerchantSelect(event: { element?: { index: number } }): void {
    const merchant = this.clickedItem(event, this.summary()?.topMerchants);
    if (merchant) this.drillDown({ search: merchant.comercio });
  }

  private clickedItem<T>(
    event: { element?: { index: number } },
    items: T[] | undefined,
  ): T | undefined {
    const index = event.element?.index;
    return index == null ? undefined : items?.[index];
  }

  /** Navigate to the expenses list carrying the dashboard's filters plus the clicked value. */
  private drillDown(overrides: Record<string, string | undefined>): void {
    const q = this.query();
    this.router.navigate(['/expenses'], {
      queryParams: {
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        account: q.accountId,
        currency: q.currency,
        concept: q.conceptId,
        search: q.search,
        category: q.categoryId ?? (q.categoryFilter === 'none' ? 'none' : undefined),
        ...overrides,
      },
    });
  }

  onFilters(query: ExpenseQuery): void {
    this.query.set(query);
    this.expenses.summary(query).subscribe((s) => this.summary.set(s));
    this.budgets.status(this.budgetMonth(query)).subscribe((b) => {
      this.budgetStatus.set(b);
      // Keep the over-budget nav badge fresh (only current-month statuses apply).
      this.alerts.updateFrom(b);
    });
  }

  /**
   * Budgets are monthly: use the filtered month when the range stays within
   * one calendar month, otherwise fall back to the current month.
   */
  private budgetMonth(query: ExpenseQuery): string | undefined {
    const from = query.dateFrom?.slice(0, 7);
    const to = query.dateTo?.slice(0, 7);
    return from && from === to ? from : undefined;
  }

  goToBudgets(): void {
    this.router.navigate(['/budgets']);
  }

  /** Open the payments list filtered by the reminder's account. */
  goToPayments(accountId: string): void {
    this.router.navigate(['/payments'], { queryParams: { account: accountId } });
  }

  /** Hide the reminder until the account's next cycle (persisted server-side). */
  dismissReminder(reminder: PaymentReminder): void {
    this.imports.dismissReminder(reminder.accountId, reminder.dueDate).subscribe({
      next: () =>
        this.reminders.update((list) =>
          list.filter((r) => r.accountId !== reminder.accountId),
        ),
      error: () => {},
    });
  }

  cappedPct(pct: number): number {
    return Math.min(pct, 100);
  }

  barColor(pct: number): string {
    if (pct >= 100) return '#ef4444';
    if (pct >= 80) return '#f59e0b';
    return '#22c55e';
  }

  /** Backfill missing exchange rates, then reload the summary. */
  refreshRates(): void {
    this.refreshingRates.set(true);
    this.expenses.refreshRates().subscribe({
      next: () => {
        this.refreshingRates.set(false);
        this.onFilters(this.query());
      },
      error: () => this.refreshingRates.set(false),
    });
  }
}
