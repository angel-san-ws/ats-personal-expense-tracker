import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ColorPickerModule } from 'primeng/colorpicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AccountsService } from '../../core/services/accounts.service';
import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { Account, AccountType } from '../../core/models';

/**
 * Manage payment sources (cards, bank accounts, cash). Accounts are created
 * automatically when statements are imported; here they can be renamed,
 * typed, colored and archived. Only unused accounts can be deleted.
 */
@Component({
  selector: 'app-accounts',
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
    ColorPickerModule,
    TagModule,
    TooltipModule,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex justify-content-between align-items-start">
        <div>
          <h1>{{ t('accounts.title') }}</h1>
          <p>{{ t('accounts.subtitle') }}</p>
        </div>
        <p-button [label]="t('accounts.new')" icon="pi pi-plus" (onClick)="openNew()" />
      </div>

      <p-card>
        <p-table [value]="accounts()" styleClass="p-datatable-sm">
          <ng-template #header>
            <tr>
              <th>{{ t('accounts.name') }}</th>
              <th>{{ t('accounts.type') }}</th>
              <th>{{ t('accounts.lastFour') }}</th>
              <th>{{ t('accounts.institution') }}</th>
              <th class="text-right">{{ t('accounts.creditLimit') }}</th>
              <th class="text-center">{{ t('accounts.paymentDueDay') }}</th>
              <th>{{ t('accounts.status') }}</th>
              <th style="width: 10rem" class="text-right">{{ t('accounts.actions') }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-a>
            <tr [style.opacity]="a.archived ? 0.5 : 1">
              <td class="font-medium">
                <span class="flex align-items-center gap-2">
                  <span
                    class="border-circle inline-block"
                    [style.background]="a.color || 'var(--p-content-border-color)'"
                    style="width: 0.75rem; height: 0.75rem"
                  ></span>
                  {{ a.name }}
                </span>
              </td>
              <td>{{ t('accounts.types.' + a.type) }}</td>
              <td>{{ a.lastFour ? '•••• ' + a.lastFour : '—' }}</td>
              <td>{{ a.institution || '—' }}</td>
              <td class="text-right">
                {{ a.creditLimit !== null ? (a.creditLimit | atsCurrency) : '—' }}
              </td>
              <td class="text-center">
                @if (a.paymentDueDay !== null) {
                  <span [pTooltip]="t('accounts.paymentDueDayHint')">
                    {{ t('accounts.dueDayValue', { day: a.paymentDueDay }) }}
                  </span>
                } @else {
                  —
                }
              </td>
              <td>
                <p-tag
                  [value]="t(a.archived ? 'accounts.archived' : 'accounts.active')"
                  [severity]="a.archived ? 'secondary' : 'success'"
                />
              </td>
              <td class="text-right">
                <p-button
                  [icon]="a.archived ? 'pi pi-eye' : 'pi pi-eye-slash'"
                  [text]="true"
                  [rounded]="true"
                  [pTooltip]="t(a.archived ? 'accounts.unarchive' : 'accounts.archive')"
                  (onClick)="toggleArchived(a)"
                />
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" (onClick)="openEdit(a)" />
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  (onClick)="confirmDelete(a)"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="8" class="text-center p-4 text-color-secondary">
                {{ t('accounts.empty') }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-dialog
        [(visible)]="dialogVisible"
        [modal]="true"
        [style]="{ width: '28rem' }"
        [header]="t(editing() ? 'accounts.edit' : 'accounts.new')"
      >
        <div class="flex flex-column gap-3 pt-2">
          <div class="flex flex-column gap-1">
            <label>{{ t('accounts.name') }} *</label>
            <input pInputText [(ngModel)]="form.name" class="w-full" />
          </div>

          <div class="flex gap-2">
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('accounts.type') }}</label>
              <p-select
                [(ngModel)]="form.type"
                [options]="typeOptions()"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                styleClass="w-full"
              />
            </div>
            <div class="flex flex-column gap-1" style="width: 8rem">
              <label>{{ t('accounts.lastFour') }}</label>
              <input pInputText [(ngModel)]="form.lastFour" maxlength="8" class="w-full" />
            </div>
          </div>

          <div class="flex flex-column gap-1">
            <label>{{ t('accounts.institution') }}</label>
            <input pInputText [(ngModel)]="form.institution" class="w-full" />
          </div>

          <div class="flex flex-column gap-1">
            <label>{{ t('accounts.creditLimit') }}</label>
            <p-inputnumber
              [(ngModel)]="form.creditLimit"
              mode="decimal"
              [minFractionDigits]="2"
              [maxFractionDigits]="2"
              [min]="0"
              styleClass="w-full"
              inputStyleClass="w-full"
            />
          </div>

          <div class="flex gap-2">
            <div class="flex flex-column gap-1" style="width: 10rem">
              <label>{{ t('accounts.paymentDueDay') }}</label>
              <p-inputnumber
                [(ngModel)]="form.paymentDueDay"
                [min]="1"
                [max]="31"
                [showButtons]="true"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
            </div>
            <div class="flex flex-column gap-1 flex-1">
              <label>{{ t('accounts.paymentAmount') }}</label>
              <p-inputnumber
                [(ngModel)]="form.paymentAmount"
                mode="decimal"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
            </div>
          </div>
          <small class="text-color-secondary">{{ t('accounts.paymentDueDayHint') }}</small>

          <div class="flex flex-column gap-1">
            <label>{{ t('accounts.color') }}</label>
            <div class="flex align-items-center gap-2">
              <p-colorpicker [(ngModel)]="form.color" appendTo="body" />
              @if (form.color) {
                <span>{{ colorValue() }}</span>
                <p-button
                  icon="pi pi-times"
                  [text]="true"
                  [rounded]="true"
                  size="small"
                  (onClick)="form.color = ''"
                />
              }
            </div>
          </div>
        </div>
        <ng-template #footer>
          <p-button [label]="t('accounts.cancel')" [text]="true" (onClick)="dialogVisible = false" />
          <p-button
            [label]="t(editing() ? 'accounts.save' : 'accounts.create')"
            icon="pi pi-check"
            [disabled]="!form.name.trim()"
            (onClick)="save()"
          />
        </ng-template>
      </p-dialog>
    </div>
  `,
})
export class AccountsComponent implements OnInit {
  private accountsSvc = inject(AccountsService);
  private confirm = inject(ConfirmationService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  accounts = signal<Account[]>([]);
  dialogVisible = false;
  editing = signal<Account | null>(null);

  form: {
    name: string;
    type: AccountType;
    lastFour: string;
    institution: string;
    creditLimit: number | null;
    paymentDueDay: number | null;
    paymentAmount: number | null;
    color: string;
  } = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  typeOptions(): { label: string; value: AccountType }[] {
    return (
      ['credit_card', 'debit_card', 'checking', 'savings', 'cash', 'other'] as const
    ).map((type) => ({
      label: this.transloco.translate(`accounts.types.${type}`),
      value: type,
    }));
  }

  /** PrimeNG ColorPicker stores hex without '#'. Normalize for display/API. */
  colorValue(): string {
    const c = this.form.color;
    if (!c) return '';
    return c.startsWith('#') ? c : `#${c}`;
  }

  private load(): void {
    this.accountsSvc.list().subscribe((a) => this.accounts.set(a));
  }

  openNew(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.dialogVisible = true;
  }

  openEdit(a: Account): void {
    this.editing.set(a);
    this.form = {
      name: a.name,
      type: a.type,
      lastFour: a.lastFour ?? '',
      institution: a.institution ?? '',
      creditLimit: a.creditLimit,
      paymentDueDay: a.paymentDueDay,
      paymentAmount: a.paymentAmount,
      color: (a.color ?? '').replace('#', ''),
    };
    this.dialogVisible = true;
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) return;
    const changes = {
      name,
      type: this.form.type,
      lastFour: this.form.lastFour.trim(),
      institution: this.form.institution.trim(),
      color: this.colorValue(),
      creditLimit: this.form.creditLimit ?? undefined,
      // null (not undefined) so clearing the field turns the reminder off.
      paymentDueDay: this.form.paymentDueDay,
      paymentAmount: this.form.paymentAmount,
    };
    const current = this.editing();
    const req = current
      ? this.accountsSvc.update(current.id, changes)
      : this.accountsSvc.create(changes);
    req.subscribe({
      next: () => {
        this.dialogVisible = false;
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            current ? 'accounts.updated' : 'accounts.created',
          ),
        });
        this.load();
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        }),
    });
  }

  toggleArchived(a: Account): void {
    this.accountsSvc.update(a.id, { archived: !a.archived }).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            a.archived ? 'accounts.unarchivedMsg' : 'accounts.archivedMsg',
          ),
        });
        this.load();
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        }),
    });
  }

  confirmDelete(a: Account): void {
    this.confirm.confirm({
      message: this.transloco.translate('accounts.deleteConfirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.accountsSvc.remove(a.id).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary: this.transloco.translate('accounts.deleted'),
            });
            this.load();
          },
          // Deleting an account with transactions is rejected by the API.
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

  private emptyForm() {
    return {
      name: '',
      type: 'credit_card' as AccountType,
      lastFour: '',
      institution: '',
      creditLimit: null,
      paymentDueDay: null,
      paymentAmount: null,
      color: '',
    };
  }
}
