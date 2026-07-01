import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CategoriesService } from '../../core/services/categories.service';
import { Category } from '../../core/models';

@Component({
  selector: 'app-categories',
  imports: [
    FormsModule,
    TranslocoDirective,
    CardModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ColorPickerModule,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header flex justify-content-between align-items-start">
        <div>
          <h1>{{ t('categories.title') }}</h1>
          <p>{{ t('categories.subtitle') }}</p>
        </div>
        <p-button [label]="t('categories.new')" icon="pi pi-plus" (onClick)="openNew()" />
      </div>

      <p-card>
        <p-table [value]="categories()" styleClass="p-datatable-sm">
          <ng-template #header>
            <tr>
              <th style="width: 4rem">{{ t('categories.color') }}</th>
              <th>{{ t('categories.name') }}</th>
              <th style="width: 8rem" class="text-right">{{ t('categories.actions') }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-c>
            <tr>
              <td><span class="color-swatch" [style.background]="c.color"></span></td>
              <td class="font-medium">{{ c.name }}</td>
              <td class="text-right">
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" (onClick)="openEdit(c)" />
                <p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" (onClick)="confirmDelete(c)" />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="3" class="text-center p-4 text-color-secondary">{{ t('categories.empty') }}</td></tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-dialog
        [(visible)]="dialogVisible"
        [modal]="true"
        [style]="{ width: '26rem' }"
        [header]="editing() ? t('categories.edit') : t('categories.new')"
      >
        <div class="flex flex-column gap-3 pt-2">
          <div class="flex flex-column gap-1">
            <label>{{ t('categories.name') }}</label>
            <input pInputText [(ngModel)]="form.name" class="w-full" />
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
            [label]="editing() ? t('categories.save') : t('categories.create')"
            icon="pi pi-check"
            [disabled]="!form.name.trim()"
            (onClick)="save()"
          />
        </ng-template>
      </p-dialog>
    </div>
  `,
})
export class CategoriesComponent implements OnInit {
  private categoriesSvc = inject(CategoriesService);
  private confirm = inject(ConfirmationService);
  private messages = inject(MessageService);
  private transloco = inject(TranslocoService);

  categories = signal<Category[]>([]);
  dialogVisible = false;
  editing = signal<Category | null>(null);
  form: { name: string; color: string } = { name: '', color: '6366f1' };

  readonly presets = [
    '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b',
  ];

  ngOnInit(): void {
    this.load();
  }

  /** PrimeNG ColorPicker stores hex without '#'. Normalize for display/API. */
  colorValue(): string {
    const c = this.form.color || '6366f1';
    return c.startsWith('#') ? c : `#${c}`;
  }

  private load(): void {
    this.categoriesSvc.list().subscribe((c) => this.categories.set(c));
  }

  openNew(): void {
    this.editing.set(null);
    this.form = { name: '', color: '6366f1' };
    this.dialogVisible = true;
  }

  openEdit(c: Category): void {
    this.editing.set(c);
    this.form = { name: c.name, color: c.color.replace('#', '') };
    this.dialogVisible = true;
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) return;
    const color = this.colorValue();
    const current = this.editing();
    const req = current
      ? this.categoriesSvc.update(current.id, { name, color })
      : this.categoriesSvc.create(name, color);
    req.subscribe({
      next: () => {
        this.dialogVisible = false;
        this.messages.add({
          severity: 'success',
          summary: this.transloco.translate(
            current ? 'categories.updated' : 'categories.created',
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

  confirmDelete(c: Category): void {
    this.confirm.confirm({
      message: this.transloco.translate('categories.deleteConfirm'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.categoriesSvc.remove(c.id).subscribe(() => {
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('categories.deleted'),
          });
          this.load();
        });
      },
    });
  }
}
