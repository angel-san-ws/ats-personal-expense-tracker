import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';

import { FilterBarComponent } from '../shared/filter-bar';
import { ExpenseFormDialogComponent } from '../shared/expense-form-dialog';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ExpensesService } from '../../core/services/expenses.service';
import { CurrencyTotal, Expense, ExpenseQuery } from '../../core/models';

@Component({
  selector: 'app-payments',
  imports: [
    TranslocoDirective,
    TableModule,
    CardModule,
    ButtonModule,
    FilterBarComponent,
    ExpenseFormDialogComponent,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1>{{ t('payments.title') }}</h1>
          <p>{{ t('payments.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <p-button
            icon="pi pi-plus"
            [label]="t('payments.add')"
            size="small"
            (onClick)="formDialog.open()"
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
        </div>
      </div>

      <app-filter-bar persistKey="payments" (filtersChange)="onFilters($event)" />

      <div class="grid mb-2">
        <div class="col-12 md:col-6 lg:col-4">
          <p-card>
            <div class="kpi-label">{{ t('payments.totalPaid') }}</div>
            @if (totalsByCurrency().length) {
              @for (ct of totalsByCurrency(); track ct.currency) {
                <div class="kpi-value">{{ ct.total | atsCurrency: ct.currency }}</div>
              }
            } @else {
              <div class="kpi-value">{{ 0 | atsCurrency }}</div>
            }
          </p-card>
        </div>
        <div class="col-12 md:col-6 lg:col-4">
          <p-card>
            <div class="kpi-label">{{ t('payments.count') }}</div>
            <div class="kpi-value">{{ total() }}</div>
          </p-card>
        </div>
      </div>

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
              <th pSortableColumn="fecha" style="width: 9rem">
                {{ t('expenses.date') }} <p-sortIcon field="fecha" />
              </th>
              <th pSortableColumn="tarjeta">{{ t('expenses.card') }} <p-sortIcon field="tarjeta" /></th>
              <th>{{ t('expenses.cardNo') }}</th>
              <th>{{ t('expenses.type') }}</th>
              <th pSortableColumn="comercio">
                {{ t('payments.description') }} <p-sortIcon field="comercio" />
              </th>
              <th pSortableColumn="valor" class="text-right">
                {{ t('expenses.amount') }} <p-sortIcon field="valor" />
              </th>
              <th class="text-center" style="width: 4rem">{{ t('expenses.actions') }}</th>
            </tr>
          </ng-template>

          <ng-template #body let-p>
            <tr>
              <td><p-tableCheckbox [value]="p" /></td>
              <td>{{ p.fecha }}</td>
              <td>{{ p.tarjeta || '—' }}</td>
              <td>{{ p.noTarjeta || '—' }}</td>
              <td>{{ p.tipoMovimiento || '—' }}</td>
              <td class="font-medium">{{ p.comercio }}</td>
              <td class="text-right font-semibold text-green-600">{{ p.valor | atsCurrency: p.currency }}</td>
              <td class="text-center">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  size="small"
                  (onClick)="formDialog.open(p)"
                />
              </td>
            </tr>
          </ng-template>

          <ng-template #emptymessage>
            <tr>
              <td colspan="8" class="text-center p-5 text-color-secondary">
                {{ t('payments.empty') }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <app-expense-form-dialog #formDialog kind="payment" (saved)="load()" />
    </div>
  `,
})
export class PaymentsComponent {
  private expensesSvc = inject(ExpensesService);
  private transloco = inject(TranslocoService);
  private confirm = inject(ConfirmationService);
  private messages = inject(MessageService);

  items = signal<Expense[]>([]);
  total = signal(0);
  totalsByCurrency = signal<CurrencyTotal[]>([]);
  size = signal(25);
  loading = signal(false);
  selected = signal<Expense[]>([]);

  private filters: ExpenseQuery = {};
  private page = 0;
  private sortField = 'fecha';
  private sortOrder = 'DESC';

  confirmDeleteSelected(): void {
    const ids = this.selected().map((p) => p.id);
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
        kind: 'payment',
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
