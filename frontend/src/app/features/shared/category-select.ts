import { Component, OnInit, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ColorPickerModule } from 'primeng/colorpicker';
import { MessageService } from 'primeng/api';

import { CategoriesService } from '../../core/services/categories.service';
import { ConceptsService } from '../../core/services/concepts.service';
import { Category } from '../../core/models';

/**
 * Category dropdown with inline "create new category" for the record dialogs.
 * The category is applied to the merchant's concept, so it covers every
 * expense of that merchant (same behavior as the Expense Concepts page).
 */
@Component({
  selector: 'app-category-select',
  imports: [
    FormsModule,
    TranslocoDirective,
    SelectModule,
    InputTextModule,
    ButtonModule,
    TooltipModule,
    ColorPickerModule,
  ],
  template: `
    <ng-container *transloco="let t">
      <div class="flex flex-column gap-1">
        <label>{{ t('categorySelect.label') }}</label>
        <div class="flex align-items-center gap-2">
          <p-select
            class="flex-1"
            [options]="categories()"
            optionLabel="name"
            optionValue="id"
            [ngModel]="categoryId()"
            (ngModelChange)="categoryId.set($event)"
            [showClear]="true"
            [placeholder]="t('categorySelect.none')"
            appendTo="body"
            styleClass="w-full"
          >
            <ng-template #selectedItem let-opt>
              <span class="flex align-items-center">
                @if (opt?.color) {
                  <span class="color-swatch" [style.background]="opt.color"></span>
                }
                {{ opt?.name }}
              </span>
            </ng-template>
            <ng-template #item let-opt>
              <span class="flex align-items-center">
                @if (opt.color) {
                  <span class="color-swatch" [style.background]="opt.color"></span>
                }
                {{ opt.name }}
              </span>
            </ng-template>
          </p-select>
          <p-button
            icon="pi pi-sparkles"
            [text]="true"
            [rounded]="true"
            [disabled]="!merchant().trim()"
            [loading]="suggesting()"
            [pTooltip]="t('categorySelect.auto')"
            (onClick)="suggest()"
          />
          <p-button
            icon="pi pi-plus"
            [text]="true"
            [rounded]="true"
            [pTooltip]="t('categorySelect.new')"
            (onClick)="toggleCreate()"
          />
        </div>
        @if (creating()) {
          <div class="flex align-items-center gap-2">
            <input
              pInputText
              [(ngModel)]="newName"
              class="flex-1"
              [placeholder]="t('categorySelect.newPlaceholder')"
              (keyup.enter)="createCategory()"
            />
            <p-colorpicker
              [(ngModel)]="newColor"
              appendTo="body"
              [pTooltip]="t('categorySelect.color')"
            />
            <p-button
              icon="pi pi-check"
              [text]="true"
              [rounded]="true"
              [disabled]="!newName.trim()"
              [loading]="busy()"
              (onClick)="createCategory()"
            />
          </div>
          <div class="flex flex-wrap gap-2 mt-1">
            @for (preset of presets; track preset) {
              <button
                type="button"
                class="p-0 border-none cursor-pointer border-round"
                [style.background]="preset"
                [style.width.rem]="1.25"
                [style.height.rem]="1.25"
                [style.outline]="colorValue().toLowerCase() === preset ? '2px solid var(--p-primary-color)' : 'none'"
                [style.outlineOffset.px]="2"
                (click)="newColor = preset.replace('#', '')"
              ></button>
            }
          </div>
        }
        <small class="text-color-secondary">{{ t('categorySelect.hint') }}</small>
      </div>
    </ng-container>
  `,
})
export class CategorySelectComponent implements OnInit {
  private categoriesSvc = inject(CategoriesService);
  private conceptsSvc = inject(ConceptsService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  /** Two-way bound selected category id (null = uncategorized). */
  categoryId = model<string | null>(null);

  /** Merchant name the auto-suggest button matches against. */
  merchant = input<string>('');

  categories = signal<Category[]>([]);
  creating = signal(false);
  busy = signal(false);
  suggesting = signal(false);
  newName = '';
  /** PrimeNG ColorPicker stores hex without '#'. */
  newColor = '6366f1';

  // Same palette as the Categories page; the default color rotates through it.
  readonly presets = [
    '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b',
  ];

  ngOnInit(): void {
    this.reload();
  }

  /** Parents call this when their dialog opens so the list is fresh. */
  reload(): void {
    this.categoriesSvc.list().subscribe((c) => this.categories.set(c));
  }

  /** Hex color with '#', as the API and swatches expect it. */
  colorValue(): string {
    const c = this.newColor || '6366f1';
    return c.startsWith('#') ? c : `#${c}`;
  }

  toggleCreate(): void {
    if (!this.creating()) {
      const preset = this.presets[this.categories().length % this.presets.length];
      this.newColor = preset.replace('#', '');
    }
    this.creating.set(!this.creating());
  }

  /** Suggest a category for the merchant (learned + keyword rules). */
  suggest(): void {
    const name = this.merchant().trim();
    if (!name || this.suggesting()) return;
    this.suggesting.set(true);
    this.conceptsSvc.suggest(name).subscribe({
      next: ({ suggestion }) => {
        this.suggesting.set(false);
        if (suggestion) {
          this.categoryId.set(suggestion.categoryId);
        } else {
          this.messages.add({
            severity: 'info',
            summary: this.transloco.translate('categorySelect.autoNone'),
          });
        }
      },
      error: (err) => {
        this.suggesting.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }

  createCategory(): void {
    const name = this.newName.trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    this.categoriesSvc.create(name, this.colorValue()).subscribe({
      next: (cat) => {
        this.busy.set(false);
        this.creating.set(false);
        this.newName = '';
        this.categories.set(
          [...this.categories(), cat].sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.categoryId.set(cat.id);
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate('categories.created'),
        });
      },
      error: (err) => {
        this.busy.set(false);
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('common.error'),
          detail: err?.error?.message,
        });
      },
    });
  }
}
