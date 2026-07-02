import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ColorPickerModule } from 'primeng/colorpicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ConceptsService } from '../../core/services/concepts.service';
import { CategoriesService } from '../../core/services/categories.service';
import { Category, Concept } from '../../core/models';

interface CategoryOption {
  label: string;
  value: string | null;
  color: string | null;
}

@Component({
  selector: 'app-concepts',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    TableModule,
    SelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    CheckboxModule,
    ButtonModule,
    DialogModule,
    ColorPickerModule,
    TooltipModule,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex justify-content-between align-items-start">
        <div>
          <h1>{{ t('concepts.title') }}</h1>
          <p>{{ t('concepts.subtitle') }}</p>
        </div>
        <div class="flex gap-2">
          <p-button
            [label]="t('concepts.autoAssign')"
            icon="pi pi-sparkles"
            severity="secondary"
            [outlined]="true"
            [loading]="autoAssigning()"
            [disabled]="uncategorizedCount() === 0"
            [pTooltip]="t('concepts.autoAssignHint')"
            tooltipPosition="bottom"
            (onClick)="autoAssign()"
          />
          <p-button [label]="t('categories.new')" icon="pi pi-plus" (onClick)="openNewCategory(null)" />
        </div>
      </div>

      <p-card>
        <p-table
          [value]="displayedConcepts()"
          styleClass="p-datatable-sm"
          [paginator]="true"
          [rows]="25"
          [rowsPerPageOptions]="[25, 50, 100]"
          [globalFilterFields]="['name']"
          #dt
        >
          <ng-template #caption>
            <div class="flex flex-wrap gap-3 align-items-center justify-content-between">
              <p-iconfield iconPosition="left">
                <p-inputicon styleClass="pi pi-search" />
                <input
                  pInputText
                  type="text"
                  [placeholder]="t('concepts.search')"
                  (input)="dt.filterGlobal($any($event.target).value, 'contains')"
                />
              </p-iconfield>
              <div class="flex align-items-center gap-2">
                <p-checkbox
                  inputId="onlyUncat"
                  [binary]="true"
                  [ngModel]="onlyUncategorized()"
                  (onChange)="onlyUncategorized.set($event.checked)"
                />
                <label for="onlyUncat" class="cursor-pointer">
                  {{ t('concepts.onlyUncategorized') }} ({{ uncategorizedCount() }})
                </label>
              </div>
            </div>
          </ng-template>
          <ng-template #header>
            <tr>
              <th pSortableColumn="name">{{ t('concepts.name') }} <p-sortIcon field="name" /></th>
              <th style="width: 8rem" class="text-right" pSortableColumn="expenseCount">
                {{ t('concepts.count') }} <p-sortIcon field="expenseCount" />
              </th>
              <th style="width: 10rem" class="text-right" pSortableColumn="totalValor">
                {{ t('concepts.total') }} <p-sortIcon field="totalValor" />
              </th>
              <th style="width: 20rem">{{ t('concepts.category') }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-c>
            <tr>
              <td class="font-medium">{{ c.name }}</td>
              <td class="text-right">{{ c.expenseCount }}</td>
              <td class="text-right font-semibold">{{ c.totalValor | atsCurrency }}</td>
              <td>
                <div class="flex align-items-center gap-2">
                  <p-select
                    [options]="categoryOptions()"
                    [ngModel]="c.categoryId"
                    (onChange)="assign(c, $event.value)"
                    optionLabel="label"
                    optionValue="value"
                    [showClear]="true"
                    [placeholder]="t('concepts.none')"
                    styleClass="flex-1"
                    appendTo="body"
                  >
                    <ng-template #selectedItem let-opt>
                      <span class="flex align-items-center">
                        @if (opt?.color) {
                          <span class="color-swatch" [style.background]="opt.color"></span>
                        }
                        {{ opt?.label }}
                      </span>
                    </ng-template>
                    <ng-template #item let-opt>
                      <span class="flex align-items-center">
                        @if (opt.color) {
                          <span class="color-swatch" [style.background]="opt.color"></span>
                        }
                        {{ opt.label }}
                      </span>
                    </ng-template>
                  </p-select>
                  <p-button
                    icon="pi pi-plus"
                    [rounded]="true"
                    [text]="true"
                    severity="secondary"
                    [pTooltip]="t('concepts.newCategoryFor')"
                    (onClick)="openNewCategory(c.id)"
                  />
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="4" class="text-center p-4 text-color-secondary">{{ t('concepts.empty') }}</td></tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Inline "create category" dialog -->
      <p-dialog
        [(visible)]="dialogVisible"
        [modal]="true"
        [style]="{ width: '26rem' }"
        [header]="t('categories.new')"
      >
        <div class="flex flex-column gap-3 pt-2">
          <div class="flex flex-column gap-1">
            <label>{{ t('categories.name') }}</label>
            <input pInputText [(ngModel)]="form.name" class="w-full" (keyup.enter)="createCategory()" />
          </div>
          <div class="flex flex-column gap-1">
            <label>{{ t('categories.color') }}</label>
            <div class="flex align-items-center gap-2">
              <p-colorpicker [(ngModel)]="form.color" appendTo="body" />
              <span class="color-swatch" [style.background]="colorValue()"></span>
              <span>{{ colorValue() }}</span>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              @for (preset of presets; track preset) {
                <button
                  type="button"
                  class="p-0 border-none cursor-pointer border-round"
                  [style.background]="preset"
                  [style.width.rem]="1.5"
                  [style.height.rem]="1.5"
                  [style.outline]="colorValue().toLowerCase() === preset ? '2px solid var(--p-primary-color)' : 'none'"
                  [style.outlineOffset.px]="2"
                  (click)="form.color = preset.replace('#','')"
                ></button>
              }
            </div>
          </div>
        </div>
        <ng-template #footer>
          <p-button [label]="t('categories.cancel')" [text]="true" (onClick)="dialogVisible = false" />
          <p-button
            [label]="t('categories.create')"
            icon="pi pi-check"
            [disabled]="!form.name.trim()"
            (onClick)="createCategory()"
          />
        </ng-template>
      </p-dialog>
    </div>
  `,
})
export class ConceptsComponent implements OnInit {
  private conceptsSvc = inject(ConceptsService);
  private categoriesSvc = inject(CategoriesService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  concepts = signal<Concept[]>([]);
  categoryOptions = signal<CategoryOption[]>([]);
  onlyUncategorized = signal(false);
  autoAssigning = signal(false);

  dialogVisible = false;
  form: { name: string; color: string } = { name: '', color: '6366f1' };
  private assignTo: string | null = null; // concept id to auto-assign after create

  readonly presets = [
    '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b',
  ];

  displayedConcepts = computed(() =>
    this.onlyUncategorized()
      ? this.concepts().filter((c) => !c.categoryId)
      : this.concepts(),
  );

  uncategorizedCount = computed(
    () => this.concepts().filter((c) => !c.categoryId).length,
  );

  ngOnInit(): void {
    this.loadCategories();
    this.load();
  }

  colorValue(): string {
    const c = this.form.color || '6366f1';
    return c.startsWith('#') ? c : `#${c}`;
  }

  private loadCategories(): void {
    this.categoriesSvc.list().subscribe((cats: Category[]) => {
      this.categoryOptions.set(
        cats.map((c) => ({ label: c.name, value: c.id, color: c.color })),
      );
    });
  }

  private load(): void {
    this.conceptsSvc.list().subscribe((c) => this.concepts.set(c));
  }

  autoAssign(): void {
    this.autoAssigning.set(true);
    this.conceptsSvc.autoCategorize().subscribe({
      next: (res) => {
        this.autoAssigning.set(false);
        this.messages.add({
          severity: res.assigned > 0 ? 'success' : 'info',
          summary:
            res.assigned > 0
              ? this.transloco.translate('concepts.autoAssigned', {
                  count: res.assigned,
                })
              : this.transloco.translate('concepts.autoAssignedNone'),
          detail:
            res.remaining > 0
              ? this.transloco.translate('concepts.autoAssignRemaining', {
                  count: res.remaining,
                })
              : undefined,
        });
        this.load();
      },
      error: (err) => {
        this.autoAssigning.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }

  assign(concept: Concept, categoryId: string | null): void {
    this.conceptsSvc.assignCategory(concept.id, categoryId ?? null).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('concepts.assigned'),
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

  openNewCategory(conceptId: string | null): void {
    this.assignTo = conceptId;
    this.form = { name: '', color: '6366f1' };
    this.dialogVisible = true;
  }

  createCategory(): void {
    const name = this.form.name.trim();
    if (!name) return;
    this.categoriesSvc.create(name, this.colorValue()).subscribe({
      next: (cat) => {
        this.dialogVisible = false;
        this.loadCategories();
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('categories.created'),
        });
        // If launched from a concept row, assign the new category to it.
        if (this.assignTo) {
          const conceptId = this.assignTo;
          this.assignTo = null;
          const concept = this.concepts().find((c) => c.id === conceptId);
          if (concept) this.assign(concept, cat.id);
        }
      },
      error: (err) =>
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        }),
    });
  }
}
