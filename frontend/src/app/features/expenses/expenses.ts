import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { FilterBarComponent } from '../shared/filter-bar';
import { ExpenseFormDialogComponent } from '../shared/expense-form-dialog';
import { CategorySelectComponent } from '../shared/category-select';
import { AuthService } from '../../core/auth/auth.service';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ExpensesService } from '../../core/services/expenses.service';
import { ExportColumn, ExportService } from '../../core/services/export.service';
import { CurrencyTotal, Expense, ExpenseQuery } from '../../core/models';

@Component({
  selector: 'app-expenses',
  imports: [
    FormsModule,
    TranslocoDirective,
    TableModule,
    CardModule,
    TagModule,
    CheckboxModule,
    TooltipModule,
    ButtonModule,
    DialogModule,
    FilterBarComponent,
    ExpenseFormDialogComponent,
    CategorySelectComponent,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex align-items-center justify-content-between flex-wrap gap-2">
        <h1>{{ t('expenses.title') }}</h1>
        <div class="flex flex-wrap gap-2">
          <p-button
            icon="pi pi-plus"
            [label]="t('expenses.add')"
            size="small"
            (onClick)="formDialog.open()"
          />
          <p-button
            icon="pi pi-tag"
            [label]="t('expenses.categorizeSelected', { count: selected().length })"
            [outlined]="true"
            size="small"
            [disabled]="selectedConceptCount() === 0"
            (onClick)="openCategorize()"
          />
          <p-button
            icon="pi pi-trash"
            [label]="t('expenses.deleteSelected', { count: selected().length })"
            severity="danger"
            [outlined]="true"
            size="small"
            [disabled]="selected().length === 0"
            (onClick)="confirmDeleteSelected()"
          />
          <p-button
            icon="pi pi-file-excel"
            [label]="t('expenses.exportExcel')"
            severity="success"
            [outlined]="true"
            size="small"
            [loading]="exporting()"
            [disabled]="exporting() || total() === 0"
            (onClick)="export('excel')"
          />
          <p-button
            icon="pi pi-file-pdf"
            [label]="t('expenses.exportPdf')"
            severity="danger"
            [outlined]="true"
            size="small"
            [loading]="exporting()"
            [disabled]="exporting() || total() === 0"
            (onClick)="export('pdf')"
          />
        </div>
      </div>

      <app-filter-bar persistKey="expenses" (filtersChange)="onFilters($event)" />

      <p-card>
        <p-table
          [value]="items()"
          [lazy]="true"
          (onLazyLoad)="onLazyLoad($event)"
          [paginator]="true"
          [rows]="size()"
          [totalRecords]="total()"
          [rowsPerPageOptions]="[10, 25, 50, 100]"
          [loading]="loading()"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="{first}–{last} / {totalRecords}"
          sortField="fecha"
          [sortOrder]="-1"
          dataKey="id"
          [selection]="selected()"
          (selectionChange)="selected.set($event)"
          styleClass="p-datatable-sm"
        >
          <ng-template #header>
            <tr>
              <th style="width: 3rem"><p-tableHeaderCheckbox /></th>
              <th pSortableColumn="fecha" style="width: 8rem">
                {{ t('expenses.date') }} <p-sortIcon field="fecha" />
              </th>
              <th pSortableColumn="tarjeta">{{ t('expenses.card') }} <p-sortIcon field="tarjeta" /></th>
              <th>{{ t('expenses.cardNo') }}</th>
              <th>{{ t('expenses.type') }}</th>
              <th pSortableColumn="comercio">
                {{ t('expenses.merchant') }} <p-sortIcon field="comercio" />
              </th>
              <th>{{ t('expenses.category') }}</th>
              <th pSortableColumn="valor" class="text-right">
                {{ t('expenses.amount') }} <p-sortIcon field="valor" />
              </th>
              <th class="text-center" style="width: 6rem">
                <span [pTooltip]="t('expenses.excludeHint')">{{ t('expenses.include') }}</span>
              </th>
              <th class="text-center" style="width: 4rem">{{ t('expenses.actions') }}</th>
            </tr>
          </ng-template>

          <ng-template #body let-e>
            <tr [style.opacity]="e.excluded ? 0.5 : 1">
              <td><p-tableCheckbox [value]="e" /></td>
              <td>{{ e.fecha }}</td>
              <td>{{ e.tarjeta || '—' }}</td>
              <td>{{ e.noTarjeta || '—' }}</td>
              <td>{{ e.tipoMovimiento || '—' }}</td>
              <td class="font-medium">
                {{ e.comercio }}
                @if (e.recurringExpenseId) {
                  <i
                    class="pi pi-sync text-xs text-color-secondary ml-1"
                    [pTooltip]="t('expenses.recurringHint')"
                  ></i>
                }
              </td>
              <td>
                @if (e.categoryName) {
                  <p-tag
                    [value]="e.categoryName"
                    [style]="{ background: e.categoryColor, color: textColor(e.categoryColor) }"
                  />
                } @else {
                  <span class="text-color-secondary">{{ t('filters.uncategorized') }}</span>
                }
              </td>
              <td class="text-right font-semibold">
                {{ e.valor | atsCurrency: e.currency }}
                @if (e.currency !== baseCurrency() && e.exchangeRate != null) {
                  <div
                    class="text-xs text-color-secondary font-normal"
                    [pTooltip]="t('expenses.convertedHint')"
                  >
                    {{ e.valor * e.exchangeRate | atsCurrency: baseCurrency() }}
                  </div>
                }
              </td>
              <td class="text-center">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="!e.excluded"
                  (onChange)="toggleInclude(e, $event.checked)"
                  [pTooltip]="t('expenses.excludeHint')"
                />
              </td>
              <td class="text-center">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  size="small"
                  (onClick)="formDialog.open(e)"
                />
              </td>
            </tr>
          </ng-template>

          <ng-template #emptymessage>
            <tr>
              <td colspan="10" class="text-center p-5 text-color-secondary">
                {{ t('expenses.empty') }}
              </td>
            </tr>
          </ng-template>

          <ng-template #footer>
            @if (selected().length > 0) {
              <tr>
                <td colspan="7" class="text-right font-bold">
                  {{ t('expenses.selectedTotal', { count: selected().length }) }}
                </td>
                <td class="text-right font-bold">
                  @for (ct of selectedTotalsByCurrency(); track ct.currency) {
                    <div>{{ ct.total | atsCurrency: ct.currency }}</div>
                  }
                </td>
                <td></td>
                <td></td>
              </tr>
            }
            <tr>
              <td colspan="7" class="text-right font-bold">
                {{ t('expenses.total') }} ({{ total() }})
              </td>
              <td class="text-right font-bold">
                @for (ct of totalsByCurrency(); track ct.currency) {
                  <div>{{ ct.total | atsCurrency: ct.currency }}</div>
                }
              </td>
              <td></td>
              <td></td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <app-expense-form-dialog #formDialog kind="expense" (saved)="load()" />

      <p-dialog
        [header]="t('expenses.categorizeHeader')"
        [visible]="categorizeVisible()"
        (visibleChange)="categorizeVisible.set($event)"
        [modal]="true"
        [style]="{ width: '26rem' }"
        [dismissableMask]="true"
      >
        <div class="flex flex-column gap-3">
          <span>{{ t('expenses.categorizeNote', { merchants: selectedConceptCount() }) }}</span>
          <app-category-select
            [categoryId]="categorizeCategoryId()"
            (categoryIdChange)="categorizeCategoryId.set($event)"
            [merchant]="categorizeMerchant()"
          />
        </div>
        <ng-template #footer>
          <p-button
            [label]="t('expenses.categorizeCancel')"
            [text]="true"
            severity="secondary"
            (onClick)="categorizeVisible.set(false)"
          />
          <p-button
            [label]="t('expenses.categorizeApply')"
            icon="pi pi-check"
            [loading]="categorizing()"
            (onClick)="applyCategorize()"
          />
        </ng-template>
      </p-dialog>
    </div>
  `,
})
export class ExpensesComponent {
  private expensesSvc = inject(ExpensesService);
  private exportSvc = inject(ExportService);
  private transloco = inject(TranslocoService);
  private confirm = inject(ConfirmationService);
  private messages = inject(MessageService);
  private auth = inject(AuthService);

  baseCurrency = computed(() => this.auth.user()?.currency || 'GTQ');

  items = signal<Expense[]>([]);
  total = signal(0);
  totalsByCurrency = signal<CurrencyTotal[]>([]);
  size = signal(25);
  loading = signal(false);
  exporting = signal(false);
  selected = signal<Expense[]>([]);

  categorizeVisible = signal(false);
  categorizeCategoryId = signal<string | null>(null);
  categorizing = signal(false);

  /** Distinct merchants (concepts) among the selected rows; payments carry none. */
  selectedConceptCount = computed(
    () => new Set(this.selected().map((e) => e.conceptId).filter(Boolean)).size,
  );

  /** Merchant name for the auto-suggest button — only when the selection has exactly one. */
  categorizeMerchant = computed(() => {
    const merchants = new Set(
      this.selected()
        .filter((e) => e.conceptId)
        .map((e) => e.comercio),
    );
    return merchants.size === 1 ? [...merchants][0] : '';
  });

  /** Totals of the selected rows, grouped by original currency (like totalsByCurrency). */
  selectedTotalsByCurrency = computed<CurrencyTotal[]>(() => {
    const sums = new Map<string, { total: number; count: number }>();
    for (const e of this.selected()) {
      const acc = sums.get(e.currency) ?? { total: 0, count: 0 };
      acc.total += e.valor;
      acc.count += 1;
      sums.set(e.currency, acc);
    }
    return [...sums.entries()].map(([currency, acc]) => ({ currency, ...acc }));
  });

  private filters: ExpenseQuery = {};
  private page = 0;
  private sortField = 'fecha';
  private sortOrder = 'DESC';

  /** Pick a readable text color (black/white) for a given tag background. */
  textColor(hex: string | null): string {
    if (!hex) return '#ffffff';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((n) => isNaN(n))) return '#ffffff';
    // Relative luminance (sRGB) — dark backgrounds get white text.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1f2937' : '#ffffff';
  }

  toggleInclude(expense: Expense, included: boolean): void {
    const excluded = !included;
    this.expensesSvc.setExcluded(expense.id, excluded).subscribe({
      next: () => (expense.excluded = excluded),
      error: () => {},
    });
  }

  async export(format: 'excel' | 'pdf'): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const t = (key: string) => this.transloco.translate(key);
      const data = await this.exportSvc.fetchAll({
        ...this.filters,
        sortField: this.sortField,
        sortOrder: this.sortOrder,
      });
      const columns: ExportColumn[] = [
        { header: t('expenses.date'), value: (e) => e.fecha },
        { header: t('expenses.card'), value: (e) => e.tarjeta ?? '' },
        { header: t('expenses.cardNo'), value: (e) => e.noTarjeta ?? '' },
        { header: t('expenses.type'), value: (e) => e.tipoMovimiento ?? '' },
        { header: t('expenses.merchant'), value: (e) => e.comercio },
        {
          header: t('expenses.category'),
          value: (e) => e.categoryName ?? t('filters.uncategorized'),
        },
        { header: t('filters.currency'), value: (e) => e.currency },
        { header: t('expenses.amount'), value: (e) => e.valor },
      ];
      const filename = `expenses_${new Date().toISOString().slice(0, 10)}`;
      const title = t('expenses.title');
      const totalLabel = t('expenses.total');
      if (format === 'excel') {
        await this.exportSvc.exportExcel(data, columns, filename, title, totalLabel);
      } else {
        await this.exportSvc.exportPdf(data, columns, filename, title, totalLabel);
      }
    } finally {
      this.exporting.set(false);
    }
  }

  openCategorize(): void {
    if (this.selectedConceptCount() === 0) return;
    // Preselect the common category when the whole selection already shares one.
    const ids = new Set(this.selected().map((e) => e.categoryId));
    this.categorizeCategoryId.set(ids.size === 1 ? [...ids][0] : null);
    this.categorizeVisible.set(true);
  }

  applyCategorize(): void {
    if (this.categorizing()) return;
    const ids = this.selected().map((e) => e.id);
    if (ids.length === 0) return;
    this.categorizing.set(true);
    this.expensesSvc.batchAssignCategory(ids, this.categorizeCategoryId()).subscribe({
      next: (res) => {
        this.categorizing.set(false);
        this.categorizeVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('expenses.categorizedCount', {
            count: res.concepts,
          }),
        });
        this.selected.set([]);
        this.load();
      },
      error: (err) => {
        this.categorizing.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }

  confirmDeleteSelected(): void {
    const ids = this.selected().map((e) => e.id);
    if (ids.length === 0) return;
    this.confirm.confirm({
      message: this.transloco.translate('expenses.deleteSelectedConfirm', {
        count: ids.length,
      }),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.expensesSvc.batchDelete(ids).subscribe({
          next: (res) => {
            this.messages.add({
              severity: 'success',
              summary: this.transloco.translate('expenses.deletedCount', {
                count: res.deleted,
              }),
            });
            this.selected.set([]);
            this.load();
          },
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: this.transloco.translate('common.error'),
              detail: err?.error?.message,
            }),
        });
      },
    });
  }

  onFilters(query: ExpenseQuery): void {
    this.filters = query;
    this.page = 0;
    this.selected.set([]);
    this.load();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? 25;
    this.size.set(rows);
    this.page = Math.floor((event.first ?? 0) / rows);
    if (event.sortField) {
      this.sortField = Array.isArray(event.sortField)
        ? event.sortField[0]
        : event.sortField;
    }
    this.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.expensesSvc
      .list({
        ...this.filters,
        page: this.page,
        size: this.size(),
        sortField: this.sortField,
        sortOrder: this.sortOrder,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.totalsByCurrency.set(res.totalsByCurrency);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
