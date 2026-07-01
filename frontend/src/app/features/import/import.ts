import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FileUpload, FileUploadHandlerEvent } from 'primeng/fileupload';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AtsCurrencyPipe } from '../../core/currency.pipe';
import { ImportService } from '../../core/services/import.service';
import { ImportBatch, ImportResult } from '../../core/models';

@Component({
  selector: 'app-import',
  imports: [
    DatePipe,
    TranslocoDirective,
    FileUpload,
    CardModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    AtsCurrencyPipe,
  ],
  template: `
    <div *transloco="let t">
      <div class="page-header">
        <h1>{{ t('import.title') }}</h1>
        <p>{{ t('import.subtitle') }}</p>
      </div>

      <div class="grid">
        <div class="col-12 lg:col-7">
          <p-card>
            <p-fileupload
              #fu
              name="file"
              [customUpload]="true"
              (uploadHandler)="onUpload($event, fu)"
              [multiple]="false"
              accept=".xls,.xlsx,.xlsm,.csv"
              [maxFileSize]="15728640"
              [chooseLabel]="t('import.choose')"
              [uploadLabel]="t('import.upload')"
              [cancelLabel]="t('import.cancel')"
            >
              <ng-template
                #file
                let-file
                let-removeFileCallback="removeFileCallback"
                let-index="index"
              >
                <div class="flex align-items-center gap-3 p-2 border-round surface-100 mt-2">
                  <i class="pi pi-file-excel text-2xl" style="color: var(--p-green-600)"></i>
                  <div class="flex-1">
                    <div class="font-medium">{{ file.name }}</div>
                    <div class="text-sm text-color-secondary">
                      {{ (file.size / 1024).toFixed(1) }} KB
                    </div>
                  </div>
                  <p-button
                    icon="pi pi-times"
                    [rounded]="true"
                    [text]="true"
                    severity="danger"
                    (onClick)="removeFileCallback($event, index)"
                  />
                </div>
              </ng-template>
              <ng-template #empty>
                <div class="text-center p-4 text-color-secondary">
                  <i class="pi pi-cloud-upload text-4xl mb-2 block"></i>
                  {{ t('import.dropHint') }}
                </div>
              </ng-template>
            </p-fileupload>
          </p-card>

          @if (result(); as r) {
            <p-card [header]="t('import.result')" styleClass="mt-3">
              <div class="grid">
                <div class="col-6 md:col-3"><span class="kpi-label">{{ t('import.rows') }}</span><div class="text-xl font-bold">{{ r.rowCount }}</div></div>
                <div class="col-6 md:col-3"><span class="kpi-label">{{ t('import.payments') }}</span><div class="text-xl font-bold">{{ r.paymentsImported }}</div></div>
                <div class="col-6 md:col-3"><span class="kpi-label">{{ t('import.duplicates') }}</span><div class="text-xl font-bold">{{ r.duplicatesSkipped }}</div></div>
                <div class="col-6 md:col-3"><span class="kpi-label">{{ t('import.newConcepts') }}</span><div class="text-xl font-bold">{{ r.newConcepts }}</div></div>
                <div class="col-12"><hr class="border-top-1 surface-border" /></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.cardholder') }}</span><div>{{ r.metadata.cardholderName || '—' }}</div></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.cardNumber') }}</span><div>{{ r.metadata.cardNumber || '—' }}</div></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.creditLimit') }}</span><div>{{ r.metadata.creditLimit | atsCurrency }}</div></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.availableLimit') }}</span><div>{{ r.metadata.availableLimit | atsCurrency }}</div></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.statementDate') }}</span><div>{{ r.metadata.statementDate || '—' }}</div></div>
                <div class="col-6"><span class="kpi-label">{{ t('import.paymentDue') }}</span><div>{{ r.metadata.paymentDueDate || '—' }}</div></div>
              </div>
            </p-card>
          }
        </div>

        <div class="col-12 lg:col-5">
          <p-card [header]="t('import.history')">
            <p-table [value]="batches()" styleClass="p-datatable-sm" [scrollable]="true" scrollHeight="24rem">
              <ng-template #header>
                <tr>
                  <th>{{ t('import.filename') }}</th>
                  <th class="text-right">{{ t('import.rows') }}</th>
                  <th>{{ t('import.importedAt') }}</th>
                  <th style="width: 3rem"></th>
                </tr>
              </ng-template>
              <ng-template #body let-b>
                <tr>
                  <td class="white-space-nowrap overflow-hidden text-overflow-ellipsis" style="max-width: 12rem">{{ b.filename }}</td>
                  <td class="text-right">{{ b.rowCount }}</td>
                  <td>{{ b.importedAt | date: 'short' }}</td>
                  <td>
                    <p-button
                      icon="pi pi-trash"
                      [rounded]="true"
                      [text]="true"
                      severity="danger"
                      [pTooltip]="t('import.deleteBatch')"
                      (onClick)="confirmDeleteBatch(b)"
                    />
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage>
                <tr><td colspan="4" class="text-center p-3 text-color-secondary">{{ t('import.noHistory') }}</td></tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>
      </div>
    </div>
  `,
})
export class ImportComponent implements OnInit {
  private importSvc = inject(ImportService);
  private messages = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private transloco = inject(TranslocoService);

  result = signal<ImportResult | null>(null);
  batches = signal<ImportBatch[]>([]);

  ngOnInit(): void {
    this.loadBatches();
  }

  onUpload(event: FileUploadHandlerEvent, fu: FileUpload): void {
    const file = event.files?.[0];
    if (!file) return;
    this.importSvc.upload(file).subscribe({
      next: (res) => {
        this.result.set(res);
        this.messages.add({
          severity: res.rowCount === 0 ? 'info' : 'success',
          summary: this.transloco.translate('import.success', {
            rows: res.rowCount,
            concepts: res.newConcepts,
          }),
          detail:
            res.duplicatesSkipped > 0
              ? this.transloco.translate('import.duplicatesSkipped', {
                  count: res.duplicatesSkipped,
                })
              : undefined,
        });
        fu.clear();
        this.loadBatches();
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: this.transloco.translate('import.error'),
          detail: err?.error?.message,
        });
        fu.clear();
      },
    });
  }

  confirmDeleteBatch(batch: ImportBatch): void {
    this.confirm.confirm({
      message: this.transloco.translate('import.deleteConfirm', {
        filename: batch.filename,
        rows: batch.rowCount,
      }),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.importSvc.deleteBatch(batch.id).subscribe({
          next: (res) => {
            this.messages.add({
              severity: 'success',
              summary: this.transloco.translate('import.deleted', {
                rows: res.deletedExpenses,
              }),
            });
            this.loadBatches();
          },
          error: (err) => {
            this.messages.add({
              severity: 'error',
              summary: this.transloco.translate('common.error'),
              detail: err?.error?.message,
            });
          },
        });
      },
    });
  }

  private loadBatches(): void {
    this.importSvc.batches().subscribe((b) => this.batches.set(b));
  }
}
