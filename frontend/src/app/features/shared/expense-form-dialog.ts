import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

import { AccountsService } from '../../core/services/accounts.service';
import { ExpensesService } from '../../core/services/expenses.service';
import { AuthService } from '../../core/auth/auth.service';
import { Expense, ExpenseInput, ExpenseKind } from '../../core/models';
import { CategorySelectComponent } from './category-select';

/**
 * Modal form to manually add or edit an expense/payment.
 * Parents call open() (new) or open(expense) (edit) and refresh on (saved).
 */
@Component({
  selector: 'app-expense-form-dialog',
  imports: [
    FormsModule,
    TranslocoDirective,
    DialogModule,
    DatePickerModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
    CategorySelectComponent,
  ],
  template: `
    <ng-container *transloco="let t">
      <p-dialog
        [(visible)]="visible"
        [modal]="true"
        [style]="{ width: '28rem' }"
        [header]="t(headerKey())"
        [focusOnShow]="false"
      >
        <div class="flex flex-column gap-3 pt-2">
          <div class="flex flex-column gap-1">
            <label>{{ t('expenses.date') }} *</label>
            <p-datepicker
              [(ngModel)]="form.fecha"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              appendTo="body"
              styleClass="w-full"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label>
              {{ t(kind === 'payment' ? 'payments.description' : 'expenses.merchant') }} *
            </label>
            <input pInputText [(ngModel)]="form.comercio" class="w-full" />
          </div>

          @if (kind === 'expense') {
            <app-category-select
              [(categoryId)]="form.categoryId"
              [merchant]="form.comercio"
            />
          }

          <div class="flex gap-2">
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('expenses.amount') }} *</label>
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
            <label>{{ t('expenses.account') }}</label>
            <p-select
              [(ngModel)]="form.accountId"
              [options]="accountOptions()"
              optionLabel="label"
              optionValue="value"
              [showClear]="true"
              [placeholder]="t('expenseForm.noAccount')"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
        </div>

        <ng-template #footer>
          <p-button
            [label]="t('expenseForm.cancel')"
            [text]="true"
            (onClick)="visible = false"
          />
          <p-button
            [label]="t(editing() ? 'expenseForm.save' : 'expenseForm.create')"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!isValid()"
            (onClick)="save()"
          />
        </ng-template>
      </p-dialog>
    </ng-container>
  `,
})
export class ExpenseFormDialogComponent {
  private expensesSvc = inject(ExpensesService);
  private accountsSvc = inject(AccountsService);
  private auth = inject(AuthService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  /** Which kind this dialog creates; also drives labels. */
  @Input() kind: ExpenseKind = 'expense';
  @Output() saved = new EventEmitter<void>();

  @ViewChild(CategorySelectComponent)
  private categorySelect?: CategorySelectComponent;

  visible = false;
  saving = signal(false);
  editing = signal<Expense | null>(null);
  currencyOptions = signal<string[]>([]);

  accountOptions = signal<{ label: string; value: string }[]>([]);

  form: {
    fecha: Date | null;
    comercio: string;
    valor: number | null;
    currency: string;
    accountId: string | null;
    categoryId: string | null;
  } = this.emptyForm();

  headerKey(): string {
    const editing = this.editing() !== null;
    if (this.kind === 'payment') {
      return editing ? 'expenseForm.editPayment' : 'expenseForm.newPayment';
    }
    return editing ? 'expenseForm.editExpense' : 'expenseForm.newExpense';
  }

  open(expense?: Expense): void {
    this.editing.set(expense ?? null);
    this.form = expense
      ? {
          fecha: this.parseIso(expense.fecha),
          comercio: expense.comercio,
          valor: expense.valor,
          currency: expense.currency,
          accountId: expense.accountId,
          categoryId: expense.categoryId,
        }
      : this.emptyForm();
    this.loadCurrencies();
    this.loadAccounts();
    this.categorySelect?.reload();
    this.visible = true;
  }

  isValid(): boolean {
    return (
      !!this.form.fecha &&
      this.form.comercio.trim().length > 0 &&
      this.form.valor !== null &&
      this.form.valor > 0
    );
  }

  save(): void {
    if (!this.isValid() || this.saving()) return;
    const input: ExpenseInput = {
      fecha: this.toIso(this.form.fecha as Date),
      comercio: this.form.comercio.trim(),
      valor: this.form.valor as number,
      currency: (this.form.currency || this.defaultCurrency()).trim().toUpperCase(),
      // Null detaches the expense from its account on edit.
      accountId: this.form.accountId,
      categoryId: this.form.categoryId || undefined,
    };
    const current = this.editing();
    const req = current
      ? this.expensesSvc.update(current.id, input)
      : this.expensesSvc.create({ ...input, kind: this.kind });
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.visible = false;
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            current ? 'expenseForm.updated' : 'expenseForm.created',
          ),
        });
        this.saved.emit();
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

  private emptyForm() {
    return {
      fecha: new Date(),
      comercio: '',
      valor: null,
      currency: this.defaultCurrency(),
      accountId: null,
      categoryId: null,
    };
  }

  private defaultCurrency(): string {
    return this.auth.user()?.currency || 'GTQ';
  }

  /** Active accounts for the picker; keeps an archived one that is selected. */
  private loadAccounts(): void {
    this.accountsSvc.list().subscribe({
      next: (accounts) =>
        this.accountOptions.set(
          accounts
            .filter((a) => !a.archived || a.id === this.form.accountId)
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
