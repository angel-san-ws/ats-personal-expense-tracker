import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';

import { FilterBarComponent } from '../shared/filter-bar';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ExpensesService } from '../../core/services/expenses.service';
import { DashboardSummary, ExpenseQuery } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [
    TranslocoDirective,
    CardModule,
    ChartModule,
    FilterBarComponent,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header">
        <h1>{{ t('dashboard.title') }}</h1>
      </div>

      <app-filter-bar persistKey="dashboard" (filtersChange)="onFilters($event)" />

      @if (summary(); as s) {
        <div class="grid mb-2">
          <div class="col-12 md:col-6 lg:col-3">
            <p-card>
              <div class="kpi-label">{{ t('dashboard.totalSpend') }}</div>
              @if (s.byCurrency.length) {
                @for (ct of s.byCurrency; track ct.currency) {
                  <div class="kpi-value">{{ ct.total | atsCurrency: ct.currency }}</div>
                }
              } @else {
                <div class="kpi-value">{{ 0 | atsCurrency }}</div>
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
              <div class="kpi-value">{{ s.avgValor | atsCurrency }}</div>
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
                <p-chart type="doughnut" [data]="categoryChart()" [options]="pieOptions" height="20rem" />
              </p-card>
            </div>
            <div class="col-12 lg:col-7">
              @if (useComparisonChart()) {
                <p-card [header]="t('dashboard.vsPrevious')">
                  <p-chart type="bar" [data]="comparisonChart()" [options]="barOptions" height="20rem" />
                </p-card>
              } @else if (useCumulativeChart()) {
                <p-card [header]="t('dashboard.cumulative')">
                  <p-chart type="line" [data]="cumulativeChart()" [options]="barOptions" height="20rem" />
                </p-card>
              } @else {
                <p-card [header]="t('dashboard.overTime')">
                  <p-chart type="bar" [data]="monthChart()" [options]="barOptions" height="20rem" />
                </p-card>
              }
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('dashboard.byCard')">
                <p-chart type="bar" [data]="cardChart()" [options]="barOptions" height="18rem" />
              </p-card>
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('dashboard.topMerchants')">
                <p-chart type="bar" [data]="merchantChart()" [options]="horizontalBarOptions" height="18rem" />
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
  private transloco = inject(TranslocoService);

  private query = signal<ExpenseQuery>({});
  summary = signal<DashboardSummary | null>(null);

  private lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private palette = [
    '#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
    '#ec4899', '#14b8a6', '#ef4444', '#64748b', '#84cc16',
  ];

  pieOptions = {
    plugins: { legend: { position: 'bottom' } },
    maintainAspectRatio: false,
  };
  barOptions = {
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } },
  };
  horizontalBarOptions = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    scales: { x: { beginAtZero: true } },
  };

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

  cardChart = computed(() => {
    const s = this.summary();
    if (!s) return { labels: [], datasets: [] };
    return {
      labels: s.byCard.map((c) => c.card),
      datasets: [
        { label: 'Total', data: s.byCard.map((c) => c.total), backgroundColor: '#3b82f6' },
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

  onFilters(query: ExpenseQuery): void {
    this.query.set(query);
    this.expenses.summary(query).subscribe((s) => this.summary.set(s));
  }
}
