import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { RecurringExpensesService } from '../../core/services/recurring-expenses.service';
import { AccountsService } from '../../core/services/accounts.service';
import { ExpensesService } from '../../core/services/expenses.service';
import { AuthService } from '../../core/auth/auth.service';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { CategorySelectComponent } from '../shared/category-select';
import {
  RecurrenceFrequency,
  RecurringExpense,
  RecurringExpenseInput,
} from '../../core/models';

/**
 * Manage fixed/recurring expense templates (rent, subscriptions, insurance).
 * Due instances are generated as real expenses after every save and on app load.
 */
@Component({
  selector: 'app-recurring',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    TooltipModule,
    AtsCurrencyPipe,
    CategorySelectComponent,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex justify-content-between align-items-start">
        <div>
          <h1>{{ t('recurring.title') }}</h1>
          <p>{{ t('recurring.subtitle') }}</p>
        </div>
        <p-button [label]="t('recurring.new')" icon="pi pi-plus" (onClick)="openNew()" />
      </div>

      <p-card>
        <p-table [value]="items()" styleClass="p-datatable-sm">
          <ng-template #header>
            <tr>
              <th>{{ t('recurring.merchant') }}</th>
              <th>{{ t('categorySelect.label') }}</th>
              <th class="text-right">{{ t('recurring.amount') }}</th>
              <th>{{ t('recurring.frequency') }}</th>
              <th>{{ t('recurring.nextRun') }}</th>
              <th class="text-right">{{ t('recurring.generated') }}</th>
              <th>{{ t('recurring.status') }}</th>
              <th style="width: 10rem" class="text-right">{{ t('recurring.actions') }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-r>
            <tr>
              <td class="font-medium">{{ r.comercio }}</td>
              <td>
                @if (r.categoryName) {
                  <p-tag
                    [value]="r.categoryName"
                    [style]="{ background: r.categoryColor, color: textColor(r.categoryColor) }"
                  />
                } @else {
                  <span class="text-color-secondary">{{ t('filters.uncategorized') }}</span>
                }
              </td>
              <td class="text-right">{{ r.valor | atsCurrency: r.currency }}</td>
              <td>{{ t('recurring.freq.' + r.frequency) }}</td>
              <td>{{ r.active ? r.nextRunDate : '—' }}</td>
              <td class="text-right">{{ r.generatedCount }}</td>
              <td>
                <p-tag
                  [value]="t(r.active ? 'recurring.active' : 'recurring.paused')"
                  [severity]="r.active ? 'success' : 'secondary'"
                />
              </td>
              <td class="text-right">
                <p-button
                  [icon]="r.active ? 'pi pi-pause' : 'pi pi-play'"
                  [text]="true"
                  [rounded]="true"
                  [pTooltip]="t(r.active ? 'recurring.pause' : 'recurring.resume')"
                  (onClick)="toggleActive(r)"
                />
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" (onClick)="openEdit(r)" />
                <p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" (onClick)="confirmDelete(r)" />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="8" class="text-center p-4 text-color-secondary">{{ t('recurring.empty') }}</td></tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-dialog
        [(visible)]="dialogVisible"
        [modal]="true"
        [style]="{ width: '28rem' }"
        [header]="t(editing() ? 'recurring.edit' : 'recurring.new')"
      >
        <div class="flex flex-column gap-3 pt-2">
          <div class="flex flex-column gap-1">
            <label>{{ t('recurring.merchant') }} *</label>
            <input pInputText [(ngModel)]="form.comercio" class="w-full" />
          </div>

          <app-category-select
            [(categoryId)]="form.categoryId"
            [merchant]="form.comercio"
          />

          <div class="flex gap-2">
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('recurring.amount') }} *</label>
              <p-inputnumber
                [(ngModel)]="form.valor"
                mode="decimal"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0.01"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
            </div>
            <div class="flex flex-column gap-1" style="width: 9rem">
              <label>{{ t('filters.currency') }}</label>
              <p-select
                [(ngModel)]="form.currency"
                [options]="currencyOptions()"
                [editable]="true"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
          </div>

          <div class="flex flex-column gap-1">
            <label>{{ t('recurring.frequency') }} *</label>
            <p-select
              [(ngModel)]="form.frequency"
              [options]="frequencyOptions()"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="w-full"
            />
          </div>

          <div class="flex gap-2">
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('recurring.startDate') }} *</label>
              <p-datepicker
                [(ngModel)]="form.startDate"
                dateFormat="yy-mm-dd"
                [showIcon]="true"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('recurring.endDate') }}</label>
              <p-datepicker
                [(ngModel)]="form.endDate"
                dateFormat="yy-mm-dd"
                [showIcon]="true"
                [showClear]="true"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
          </div>
          <small class="text-color-secondary">{{ t('recurring.startDateHint') }}</small>

          <div class="flex flex-column gap-1">
            <label>{{ t('recurring.account') }}</label>
            <p-select
              [(ngModel)]="form.accountId"
              [options]="accountOptions()"
              optionLabel="label"
              optionValue="value"
              [showClear]="true"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
        </div>

        <ng-template #footer>
          <p-button [label]="t('recurring.cancel')" [text]="true" (onClick)="dialogVisible = false" />
          <p-button
            [label]="t(editing() ? 'recurring.save' : 'recurring.create')"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!isValid()"
            (onClick)="save()"
          />
        </ng-template>
      </p-dialog>
    </div>
  `,
})
export class RecurringComponent implements OnInit {
  private recurringSvc = inject(RecurringExpensesService);
  private accountsSvc = inject(AccountsService);
  private expensesSvc = inject(ExpensesService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmationService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  @ViewChild(CategorySelectComponent)
  private categorySelect?: CategorySelectComponent;

  items = signal<RecurringExpense[]>([]);
  dialogVisible = false;
  saving = signal(false);
  editing = signal<RecurringExpense | null>(null);
  currencyOptions = signal<string[]>([]);
  accountOptions = signal<{ label: string; value: string }[]>([]);

  form: {
    comercio: string;
    valor: number | null;
    currency: string;
    frequency: RecurrenceFrequency;
    startDate: Date | null;
    endDate: Date | null;
    accountId: string | null;
    categoryId: string | null;
  } = this.emptyForm();

  ngOnInit(): void {
    this.load();
    this.loadCurrencies();
    this.loadAccounts();
  }

  frequencyOptions(): { label: string; value: RecurrenceFrequency }[] {
    return (['weekly', 'biweekly', 'monthly', 'yearly'] as const).map((f) => ({
      label: this.transloco.translate(`recurring.freq.${f}`),
      value: f,
    }));
  }

  private load(): void {
    this.recurringSvc.list().subscribe((items) => this.items.set(items));
  }

  openNew(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.categorySelect?.reload();
    this.dialogVisible = true;
  }

  openEdit(r: RecurringExpense): void {
    this.editing.set(r);
    this.form = {
      comercio: r.comercio,
      valor: r.valor,
      currency: r.currency,
      frequency: r.frequency,
      startDate: this.parseIso(r.startDate),
      endDate: r.endDate ? this.parseIso(r.endDate) : null,
      accountId: r.accountId,
      categoryId: r.categoryId,
    };
    this.categorySelect?.reload();
    this.dialogVisible = true;
  }

  isValid(): boolean {
    return (
      this.form.comercio.trim().length > 0 &&
      this.form.valor !== null &&
      this.form.valor > 0 &&
      !!this.form.startDate &&
      (!this.form.endDate || this.form.endDate >= this.form.startDate)
    );
  }

  save(): void {
    if (!this.isValid() || this.saving()) return;
    const input: RecurringExpenseInput = {
      comercio: this.form.comercio.trim(),
      valor: this.form.valor as number,
      currency: (this.form.currency || this.defaultCurrency()).trim().toUpperCase(),
      frequency: this.form.frequency,
      startDate: this.toIso(this.form.startDate as Date),
      endDate: this.form.endDate ? this.toIso(this.form.endDate) : '',
      // Null clears the account on edit.
      accountId: this.form.accountId,
      categoryId: this.form.categoryId || undefined,
    };
    const current = this.editing();
    const req = current
      ? this.recurringSvc.update(current.id, input)
      : this.recurringSvc.create(input);
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            current ? 'recurring.updated' : 'recurring.created',
          ),
        });
        this.generateAndReload();
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }

  toggleActive(r: RecurringExpense): void {
    this.recurringSvc.update(r.id, { active: !r.active }).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            r.active ? 'recurring.pausedMsg' : 'recurring.resumedMsg',
          ),
        });
        this.generateAndReload();
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        }),
    });
  }

  confirmDelete(r: RecurringExpense): void {
    this.confirm.confirm({
      message: this.transloco.translate('recurring.deleteConfirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.recurringSvc.remove(r.id).subscribe(() => {
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('recurring.deleted'),
          });
          this.load();
        });
      },
    });
  }

  /** Generate due instances right away so the user sees the effect. */
  private generateAndReload(): void {
    this.recurringSvc.generate().subscribe({
      next: ({ generated }) => {
        if (generated > 0) {
          this.messages.add({
            severity: 'info',
            summary: this.transloco.translate('recurring.generatedMsg', {
              count: generated,
            }),
          });
        }
        this.load();
      },
      error: () => this.load(),
    });
  }

  private emptyForm() {
    return {
      comercio: '',
      valor: null,
      currency: this.defaultCurrency(),
      frequency: 'monthly' as RecurrenceFrequency,
      startDate: new Date(),
      endDate: null,
      accountId: null,
      categoryId: null,
    };
  }

  private defaultCurrency(): string {
    return this.auth.user()?.currency || 'GTQ';
  }

  private loadAccounts(): void {
    this.accountsSvc.list().subscribe({
      next: (accounts) =>
        this.accountOptions.set(
          accounts
            .filter((a) => !a.archived)
            .map((a) => ({ label: a.name, value: a.id })),
        ),
      error: () => {},
    });
  }

  private loadCurrencies(): void {
    this.expensesSvc.currencies().subscribe((codes) => {
      const merged = Array.from(
        new Set([...codes, this.defaultCurrency(), 'GTQ', 'USD']),
      ).sort();
      this.currencyOptions.set(merged);
    });
  }

  /** Text color with enough contrast for a category tag background. */
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

  /** Format a local Date as yyyy-mm-dd (no UTC shift). */
  private toIso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /** Parse yyyy-mm-dd as a local Date (no UTC shift). */
  private parseIso(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
