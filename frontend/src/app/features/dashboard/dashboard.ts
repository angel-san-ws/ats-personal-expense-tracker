import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
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

      <app-filter-bar (filtersChange)="onFilters($event)" />

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
              <p-card [header]="t('dashboard.overTime')">
                <p-chart type="bar" [data]="monthChart()" [options]="barOptions" height="20rem" />
              </p-card>
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

  private query = signal<ExpenseQuery>({});
  summary = signal<DashboardSummary | null>(null);

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
