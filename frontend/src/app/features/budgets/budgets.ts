import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

import { BudgetsService } from '../../core/services/budgets.service';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { BudgetStatus } from '../../core/models';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface BudgetRow {
  categoryId: string;
  categoryName: string;
  color: string;
  budgetId: string | null;
  amount: number | null;
  spent: number;
  /** Percent of the budget used; null when no budget is set. */
  pct: number | null;
}

@Component({
  selector: 'app-budgets',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    TableModule,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h1>{{ t('budgets.title') }}</h1>
          <p>{{ t('budgets.subtitle') }}</p>
        </div>
        <div class="flex align-items-center gap-1">
          <p-button icon="pi pi-chevron-left" [text]="true" [rounded]="true" (onClick)="shiftMonth(-1)" />
          <span class="font-medium text-lg white-space-nowrap" style="min-width: 10rem; text-align: center">
            {{ monthLabel() }}
          </span>
          <p-button icon="pi pi-chevron-right" [text]="true" [rounded]="true" (onClick)="shiftMonth(1)" />
        </div>
      </div>

      @if (status(); as s) {
        @if (s.unconvertedCount > 0) {
          <p-message severity="warn" styleClass="w-full mb-3">
            {{ t('dashboard.unconverted', { count: s.unconvertedCount }) }}
          </p-message>
        }

        <p-card styleClass="mb-3">
          <div class="flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <div class="kpi-label">{{ t('budgets.overall') }}</div>
              <div class="kpi-value">
                {{ s.overall.spent | atsCurrency: s.baseCurrency }}
                @if (s.overall.amount !== null) {
                  <span class="text-color-secondary text-base font-normal">
                    / {{ s.overall.amount | atsCurrency: s.baseCurrency }}
                  </span>
                }
              </div>
              @if (s.overall.amount !== null) {
                <div class="text-sm mt-1" [style.color]="remainingColor(overallPct())">
                  {{ abs(s.overall.amount - s.overall.spent) | atsCurrency: s.baseCurrency }}
                  {{ t(s.overall.amount - s.overall.spent >= 0 ? 'budgets.left' : 'budgets.over') }}
                </div>
              }
            </div>
            <div class="flex align-items-center gap-2">
              <p-inputnumber
                [(ngModel)]="drafts()['overall']"
                mode="currency"
                [currency]="s.baseCurrency"
                [min]="0"
                [placeholder]="t('budgets.setBudget')"
                inputStyleClass="w-10rem text-right"
                (onBlur)="saveOverall()"
                (keydown.enter)="saveOverall()"
              />
              @if (s.overall.budgetId) {
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  (onClick)="removeBudget(s.overall.budgetId)"
                />
              }
            </div>
          </div>
          @if (s.overall.amount !== null) {
            <div class="mt-3" style="background: var(--p-content-border-color); border-radius: 999px; height: 0.5rem; overflow: hidden;">
              <div
                style="height: 100%; border-radius: 999px; transition: width 0.3s"
                [style.width.%]="cappedPct(overallPct())"
                [style.background]="barColor(overallPct())"
              ></div>
            </div>
          }
        </p-card>

        <p-card>
          <p-table [value]="rows()" styleClass="p-datatable-sm">
            <ng-template #header>
              <tr>
                <th>{{ t('budgets.category') }}</th>
                <th style="width: 12rem" class="text-right">{{ t('budgets.budget') }}</th>
                <th style="width: 9rem" class="text-right">{{ t('budgets.spent') }}</th>
                <th style="width: 9rem" class="text-right">{{ t('budgets.remaining') }}</th>
                <th style="width: 22%">{{ t('budgets.progress') }}</th>
                <th style="width: 4rem"></th>
              </tr>
            </ng-template>
            <ng-template #body let-r>
              <tr>
                <td>
                  <span class="flex align-items-center gap-2">
                    <span class="color-swatch" [style.background]="r.color"></span>
                    <span class="font-medium">{{ r.categoryName }}</span>
                  </span>
                </td>
                <td class="text-right">
                  <p-inputnumber
                    [(ngModel)]="drafts()[r.categoryId]"
                    mode="currency"
                    [currency]="s.baseCurrency"
                    [min]="0"
                    [placeholder]="t('budgets.setBudget')"
                    inputStyleClass="w-9rem text-right"
                    (onBlur)="saveCategory(r)"
                    (keydown.enter)="saveCategory(r)"
                  />
                </td>
                <td class="text-right">{{ r.spent | atsCurrency: s.baseCurrency }}</td>
                <td class="text-right" [style.color]="r.amount !== null ? remainingColor(r.pct) : undefined">
                  @if (r.amount !== null) {
                    {{ r.amount - r.spent | atsCurrency: s.baseCurrency }}
                  } @else {
                    <span class="text-color-secondary">—</span>
                  }
                </td>
                <td>
                  @if (r.pct !== null) {
                    <div class="flex align-items-center gap-2">
                      <div class="flex-1" style="background: var(--p-content-border-color); border-radius: 999px; height: 0.5rem; overflow: hidden;">
                        <div
                          style="height: 100%; border-radius: 999px; transition: width 0.3s"
                          [style.width.%]="cappedPct(r.pct)"
                          [style.background]="barColor(r.pct)"
                        ></div>
                      </div>
                      <span class="text-sm text-color-secondary" style="min-width: 3rem; text-align: right">
                        {{ r.pct.toFixed(0) }}%
                      </span>
                    </div>
                  }
                </td>
                <td class="text-right">
                  @if (r.budgetId) {
                    <p-button
                      icon="pi pi-trash"
                      [text]="true"
                      [rounded]="true"
                      severity="danger"
                      (onClick)="removeBudget(r.budgetId)"
                    />
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="6" class="text-center p-4 text-color-secondary">
                  {{ t('budgets.empty') }}
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
})
export class BudgetsComponent implements OnInit {
  private budgetsSvc = inject(BudgetsService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  month = signal(currentMonth());
  status = signal<BudgetStatus | null>(null);
  /** Editable amounts, keyed by categoryId (or 'overall'); reset on each load. */
  drafts = signal<Record<string, number | null>>({});
  /**
   * True while a save/delete + reload is in flight. Enter is followed by the
   * input's blur, which would re-save against the stale status otherwise.
   */
  private saving = false;

  private lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  monthLabel = computed(() => {
    const label = new Intl.DateTimeFormat(this.lang(), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${this.month()}-01T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  overallPct = computed(() => {
    const o = this.status()?.overall;
    return o?.amount ? (o.spent / o.amount) * 100 : null;
  });

  /** Budgeted categories first (most-used budget on top), then the rest by spend. */
  rows = computed<BudgetRow[]>(() => {
    const s = this.status();
    if (!s) return [];
    const rows = s.categories.map((c) => ({
      ...c,
      pct: c.amount ? (c.spent / c.amount) * 100 : null,
    }));
    return [
      ...rows.filter((r) => r.pct !== null).sort((a, b) => b.pct! - a.pct!),
      ...rows.filter((r) => r.pct === null).sort((a, b) => b.spent - a.spent),
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  shiftMonth(delta: number): void {
    const [year, mo] = this.month().split('-').map(Number);
    const d = new Date(year, mo - 1 + delta, 1);
    this.month.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    this.load();
  }

  private load(): void {
    this.budgetsSvc.status(this.month()).subscribe({
      next: (s) => {
        this.status.set(s);
        const drafts: Record<string, number | null> = { overall: s.overall.amount };
        for (const c of s.categories) drafts[c.categoryId] = c.amount;
        this.drafts.set(drafts);
        this.saving = false;
      },
      error: () => (this.saving = false),
    });
  }

  saveOverall(): void {
    const s = this.status();
    if (!s) return;
    this.save('overall', null, s.overall.budgetId, s.overall.amount);
  }

  saveCategory(row: BudgetRow): void {
    this.save(row.categoryId, row.categoryId, row.budgetId, row.amount);
  }

  /** Upsert on a changed positive amount; clearing an existing budget deletes it. */
  private save(
    key: string,
    categoryId: string | null,
    budgetId: string | null,
    current: number | null,
  ): void {
    const draft = this.drafts()[key];
    if (this.saving || draft === current) return;
    if (draft == null || draft <= 0) {
      if (budgetId) this.removeBudget(budgetId);
      return;
    }
    this.saving = true;
    this.budgetsSvc.upsert(categoryId, draft).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('budgets.saved'),
        });
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }

  removeBudget(id: string): void {
    if (this.saving) return;
    this.saving = true;
    this.budgetsSvc.remove(id).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('budgets.deleted'),
        });
        this.load();
      },
      error: () => (this.saving = false),
    });
  }

  cappedPct(pct: number | null): number {
    return Math.min(pct ?? 0, 100);
  }

  barColor(pct: number | null): string {
    if (pct === null) return 'transparent';
    if (pct >= 100) return '#ef4444';
    if (pct >= 80) return '#f59e0b';
    return '#22c55e';
  }

  remainingColor(pct: number | null): string | undefined {
    if (pct === null) return undefined;
    return pct >= 100 ? '#ef4444' : undefined;
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}
