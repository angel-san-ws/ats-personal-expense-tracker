import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { ExpensesService } from '../../core/services/expenses.service';
import { CategoriesService } from '../../core/services/categories.service';
import { ConceptsService } from '../../core/services/concepts.service';
import { ExpenseQuery } from '../../core/models';

interface Option {
  label: string;
  value: string;
}

@Component({
  selector: 'app-filter-bar',
  imports: [
    FormsModule,
    TranslocoDirective,
    DatePickerModule,
    SelectModule,
    InputTextModule,
    ButtonModule,
  ],
  template: `
    <div
      class="surface-card border-round p-3 mb-3 flex flex-wrap gap-3 align-items-end"
      *transloco="let t"
    >
      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.period') }}</label>
        <p-select
          [(ngModel)]="period"
          (onChange)="onPeriodChange($event.value)"
          [options]="periodOptions"
          optionValue="value"
          styleClass="w-11rem"
          appendTo="body"
        >
          <ng-template #selectedItem let-o>{{ t(o.labelKey) }}</ng-template>
          <ng-template #item let-o>{{ t(o.labelKey) }}</ng-template>
        </p-select>
      </div>

      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.dateFrom') }}</label>
        <p-datepicker
          [(ngModel)]="dateFrom"
          (onSelect)="period = 'custom'"
          (onClearClick)="period = 'custom'"
          dateFormat="yy-mm-dd"
          [showIcon]="true"
          [showButtonBar]="true"
          styleClass="w-11rem"
          appendTo="body"
        />
      </div>

      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.dateTo') }}</label>
        <p-datepicker
          [(ngModel)]="dateTo"
          (onSelect)="period = 'custom'"
          (onClearClick)="period = 'custom'"
          dateFormat="yy-mm-dd"
          [showIcon]="true"
          [showButtonBar]="true"
          styleClass="w-11rem"
          appendTo="body"
        />
      </div>

      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.card') }}</label>
        <p-select
          [(ngModel)]="card"
          [options]="cardOptions()"
          optionLabel="label"
          optionValue="value"
          [showClear]="true"
          [placeholder]="t('filters.allCards')"
          styleClass="w-11rem"
          appendTo="body"
        />
      </div>

      @if (currencyOptions().length > 1) {
        <div class="flex flex-column gap-1">
          <label class="text-sm">{{ t('filters.currency') }}</label>
          <p-select
            [(ngModel)]="currency"
            [options]="currencyOptions()"
            optionLabel="label"
            optionValue="value"
            [showClear]="true"
            [placeholder]="t('filters.allCurrencies')"
            styleClass="w-9rem"
            appendTo="body"
          />
        </div>
      }

      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.category') }}</label>
        <p-select
          [(ngModel)]="category"
          [options]="categoryOptions()"
          optionLabel="label"
          optionValue="value"
          [showClear]="true"
          [placeholder]="t('filters.allCategories')"
          styleClass="w-12rem"
          appendTo="body"
        />
      </div>

      <div class="flex flex-column gap-1">
        <label class="text-sm">{{ t('filters.concept') }}</label>
        <p-select
          [(ngModel)]="concept"
          [options]="conceptOptions()"
          optionLabel="label"
          optionValue="value"
          [showClear]="true"
          [filter]="true"
          filterBy="label"
          [placeholder]="'—'"
          styleClass="w-14rem"
          appendTo="body"
        />
      </div>

      <div class="flex flex-column gap-1 flex-1" style="min-width: 12rem">
        <label class="text-sm">{{ t('filters.search') }}</label>
        <input
          pInputText
          [(ngModel)]="search"
          class="w-full"
          (keyup.enter)="apply()"
        />
      </div>

      <div class="flex gap-2">
        <p-button [label]="t('filters.apply')" icon="pi pi-filter" (onClick)="apply()" />
        <p-button
          [label]="t('filters.clear')"
          icon="pi pi-times"
          severity="secondary"
          [outlined]="true"
          (onClick)="clear()"
        />
      </div>
    </div>
  `,
})
export class FilterBarComponent implements OnInit {
  private expensesSvc = inject(ExpensesService);
  private categoriesSvc = inject(CategoriesService);
  private conceptsSvc = inject(ConceptsService);

  @Output() filtersChange = new EventEmitter<ExpenseQuery>();

  period = 'custom';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  card: string | null = null;
  currency: string | null = null;
  category: string | null = null; // categoryId or 'none'
  concept: string | null = null;
  search = '';

  readonly periodOptions = [
    { value: 'custom', labelKey: 'periods.custom' },
    { value: 'today', labelKey: 'periods.today' },
    { value: 'thisWeek', labelKey: 'periods.thisWeek' },
    { value: 'lastWeek', labelKey: 'periods.lastWeek' },
    { value: 'thisMonth', labelKey: 'periods.thisMonth' },
    { value: 'lastMonth', labelKey: 'periods.lastMonth' },
    { value: 'thisQuarter', labelKey: 'periods.thisQuarter' },
    { value: 'lastQuarter', labelKey: 'periods.lastQuarter' },
    { value: 'thisYear', labelKey: 'periods.thisYear' },
    { value: 'lastYear', labelKey: 'periods.lastYear' },
  ];

  cardOptions = signal<Option[]>([]);
  currencyOptions = signal<Option[]>([]);
  categoryOptions = signal<Option[]>([]);
  conceptOptions = signal<Option[]>([]);

  ngOnInit(): void {
    this.expensesSvc.cards().subscribe((cards) =>
      this.cardOptions.set(cards.map((c) => ({ label: c, value: c }))),
    );
    this.expensesSvc.currencies().subscribe((currencies) =>
      this.currencyOptions.set(currencies.map((c) => ({ label: c, value: c }))),
    );
    this.categoriesSvc.list().subscribe((cats) => {
      const opts: Option[] = [
        { label: '— Uncategorized —', value: 'none' },
        ...cats.map((c) => ({ label: c.name, value: c.id })),
      ];
      this.categoryOptions.set(opts);
    });
    this.conceptsSvc.list().subscribe((concepts) =>
      this.conceptOptions.set(
        concepts.map((c) => ({ label: c.name, value: c.id })),
      ),
    );
    this.apply();
  }

  onPeriodChange(value: string): void {
    this.period = value;
    if (value !== 'custom') {
      const range = this.computeRange(value);
      this.dateFrom = range.from;
      this.dateTo = range.to;
    }
    this.apply();
  }

  /** Compute a [from, to] date range for a named preset. */
  private computeRange(period: string): { from: Date | null; to: Date | null } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const startOfDay = new Date(y, m, d);
    // Days since Monday (Mon=0 … Sun=6)
    const dow = (now.getDay() + 6) % 7;

    switch (period) {
      case 'today':
        return { from: startOfDay, to: startOfDay };
      case 'thisWeek':
        return { from: new Date(y, m, d - dow), to: new Date(y, m, d - dow + 6) };
      case 'lastWeek':
        return { from: new Date(y, m, d - dow - 7), to: new Date(y, m, d - dow - 1) };
      case 'thisMonth':
        return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
      case 'lastMonth':
        return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
      case 'thisQuarter': {
        const q = Math.floor(m / 3);
        return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 0) };
      }
      case 'lastQuarter': {
        const q = Math.floor(m / 3) - 1;
        const yy = q < 0 ? y - 1 : y;
        const qq = (q + 4) % 4;
        return { from: new Date(yy, qq * 3, 1), to: new Date(yy, qq * 3 + 3, 0) };
      }
      case 'thisYear':
        return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
      case 'lastYear':
        return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
      default:
        return { from: null, to: null };
    }
  }

  private toIso(date: Date | null): string | undefined {
    if (!date) return undefined;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private buildQuery(): ExpenseQuery {
    const query: ExpenseQuery = {
      dateFrom: this.toIso(this.dateFrom),
      dateTo: this.toIso(this.dateTo),
      card: this.card ?? undefined,
      currency: this.currency ?? undefined,
      conceptId: this.concept ?? undefined,
      search: this.search?.trim() || undefined,
    };
    if (this.category === 'none') {
      query.categoryFilter = 'none';
    } else if (this.category) {
      query.categoryId = this.category;
    }
    return query;
  }

  apply(): void {
    this.filtersChange.emit(this.buildQuery());
  }

  clear(): void {
    this.period = 'custom';
    this.dateFrom = null;
    this.dateTo = null;
    this.card = null;
    this.currency = null;
    this.category = null;
    this.concept = null;
    this.search = '';
    this.apply();
  }
}
