import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { MessageModule } from 'primeng/message';

import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ExpensesService } from '../../core/services/expenses.service';
import { ThemeService } from '../../core/theme.service';
import { YearReport } from '../../core/models';

@Component({
  selector: 'app-reports',
  imports: [
    TranslocoDirective,
    ButtonModule,
    CardModule,
    ChartModule,
    MessageModule,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex align-items-center justify-content-between flex-wrap gap-2">
        <h1>{{ t('reports.title') }}</h1>
        <div class="flex align-items-center gap-1">
          <p-button
            [text]="true"
            [rounded]="true"
            icon="pi pi-chevron-left"
            [ariaLabel]="t('reports.prevYear')"
            (onClick)="changeYear(-1)"
          />
          <span class="font-medium text-lg">{{ year() }}</span>
          <p-button
            [text]="true"
            [rounded]="true"
            icon="pi pi-chevron-right"
            [disabled]="year() >= currentYear"
            [ariaLabel]="t('reports.nextYear')"
            (onClick)="changeYear(1)"
          />
        </div>
      </div>

      @if (report(); as r) {
        @if (r.unconvertedCount > 0) {
          <p-message severity="warn" styleClass="w-full mb-3">
            {{ t('dashboard.unconverted', { count: r.unconvertedCount }) }}
          </p-message>
        }

        <div class="grid mb-2">
          <div class="col-12 md:col-4">
            <p-card>
              <div class="kpi-label">{{ t('reports.yearTotal') }}</div>
              <div class="kpi-value">{{ r.yearTotal | atsCurrency: r.baseCurrency }}</div>
            </p-card>
          </div>
          <div class="col-12 md:col-4">
            <p-card>
              <div class="kpi-label">{{ t('reports.monthlyAverage') }}</div>
              <div class="kpi-value">{{ r.monthlyAverage | atsCurrency: r.baseCurrency }}</div>
            </p-card>
          </div>
          <div class="col-12 md:col-4">
            <p-card>
              <div class="kpi-label">{{ t('reports.vsLastYear') }}</div>
              @if (r.prevYearTotal > 0) {
                <div class="kpi-value" [style.color]="delta() > 0 ? '#ef4444' : '#22c55e'">
                  {{ deltaLabel() }}
                </div>
                <div class="text-sm text-color-secondary mt-1">
                  {{ delta() | atsCurrency: r.baseCurrency }}
                  {{ t('reports.vsYear', { year: year() - 1 }) }}
                </div>
              } @else {
                <div class="kpi-value">—</div>
                <div class="text-sm text-color-secondary mt-1">
                  {{ t('reports.noPrevYear', { year: year() - 1 }) }}
                </div>
              }
            </p-card>
          </div>
        </div>

        @if (hasData()) {
          <div class="grid">
            <div class="col-12">
              <p-card [header]="t('reports.monthlyTotals')">
                <p-chart type="bar" [data]="monthlyChart()" [options]="chartOptions()" height="20rem" />
              </p-card>
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('reports.categoryTrend')">
                <p-chart type="line" [data]="categoryTrendChart()" [options]="chartOptions()" height="20rem" />
              </p-card>
            </div>
            <div class="col-12 lg:col-6">
              <p-card [header]="t('reports.budgetVsActual')">
                @if (hasBudgets()) {
                  <p-chart type="bar" [data]="budgetChart()" [options]="chartOptions()" height="20rem" />
                } @else {
                  <div class="text-center p-5 text-color-secondary">
                    {{ t('reports.noBudgets') }}
                  </div>
                }
              </p-card>
            </div>
          </div>
        } @else {
          <p-card>
            <div class="text-center p-5 text-color-secondary">
              <i class="pi pi-inbox text-4xl mb-3 block"></i>
              {{ t('reports.noData') }}
            </div>
          </p-card>
        }
      }
    </div>
  `,
})
export class ReportsComponent {
  private expenses = inject(ExpensesService);
  private transloco = inject(TranslocoService);
  private theme = inject(ThemeService);

  readonly currentYear = new Date().getFullYear();
  year = signal(this.currentYear);
  report = signal<YearReport | null>(null);

  constructor() {
    this.load();
  }

  changeYear(delta: number): void {
    this.year.update((y) => y + delta);
    this.load();
  }

  private load(): void {
    this.expenses.report(this.year()).subscribe((r) => this.report.set(r));
  }

  private lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private palette = [
    '#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
    '#ec4899', '#14b8a6', '#ef4444', '#64748b', '#84cc16',
  ];

  hasData = computed(
    () => this.report()?.months.some((m) => m.count > 0) ?? false,
  );

  hasBudgets = computed(
    () => this.report()?.months.some((m) => m.budget !== null) ?? false,
  );

  delta = computed(() => {
    const r = this.report();
    return r ? r.yearTotal - r.prevYearTotal : 0;
  });

  /** Signed percent change vs. the previous year, e.g. "+12.3%". */
  deltaLabel = computed(() => {
    const r = this.report();
    if (!r || r.prevYearTotal <= 0) return '—';
    const pct = (this.delta() / r.prevYearTotal) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  });

  private monthLabels = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.lang(), { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
  });

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

  chartOptions = computed(() => ({
    plugins: {
      legend: { position: 'bottom', labels: { color: this.chartColors().text } },
    },
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

  /** Monthly totals with the previous year as a muted overlay. */
  monthlyChart = computed(() => {
    const r = this.report();
    if (!r) return { labels: [], datasets: [] };
    return {
      labels: this.monthLabels(),
      datasets: [
        {
          label: String(r.year - 1),
          data: r.months.map((m) => m.prevTotal),
          backgroundColor: '#94a3b8',
        },
        {
          label: String(r.year),
          data: r.months.map((m) => m.total),
          backgroundColor: '#6366f1',
        },
      ],
    };
  });

  /** One line per category (top 8 by year total), in the category's color. */
  categoryTrendChart = computed(() => {
    const r = this.report();
    if (!r) return { labels: [], datasets: [] };
    return {
      labels: this.monthLabels(),
      datasets: r.byCategory.slice(0, 8).map((c, i) => {
        const color = c.color || this.palette[i % this.palette.length];
        return {
          label: c.categoryName,
          data: c.monthlyTotals,
          borderColor: color,
          backgroundColor: color,
          pointRadius: 2,
          pointHitRadius: 8,
          tension: 0,
        };
      }),
    };
  });

  /** Actual spend bars (red when over budget) with the budget as a line. */
  budgetChart = computed(() => {
    const r = this.report();
    if (!r) return { labels: [], datasets: [] };
    this.lang(); // re-translate dataset labels on language switch
    return {
      labels: this.monthLabels(),
      datasets: [
        {
          type: 'line',
          label: this.transloco.translate('reports.budget'),
          data: r.months.map((m) => m.budget),
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          pointRadius: 3,
          tension: 0,
        },
        {
          type: 'bar',
          label: this.transloco.translate('reports.actual'),
          data: r.months.map((m) => m.total),
          backgroundColor: r.months.map((m) =>
            m.budget !== null && m.total > m.budget ? '#ef4444' : '#6366f1',
          ),
        },
      ],
    };
  });
}
