import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExpensesService } from './expenses.service';
import { CurrencyTotal, Expense, ExpenseQuery } from '../models';

export interface ExportColumn {
  header: string;
  value: (e: Expense) => string | number;
}

export interface ExportData {
  rows: Expense[];
  totalsByCurrency: CurrencyTotal[];
}

/** Backend caps page size at 500 (QueryExpensesDto). */
const EXPORT_PAGE_SIZE = 500;

@Injectable({ providedIn: 'root' })
export class ExportService {
  private expensesSvc = inject(ExpensesService);

  /** Fetch every expense matching the query, paging past the API size cap. */
  async fetchAll(query: ExpenseQuery): Promise<ExportData> {
    const rows: Expense[] = [];
    let totalsByCurrency: CurrencyTotal[] = [];
    let page = 0;
    for (;;) {
      const res = await firstValueFrom(
        this.expensesSvc.list({ ...query, page, size: EXPORT_PAGE_SIZE }),
      );
      rows.push(...res.items);
      totalsByCurrency = res.totalsByCurrency;
      if (rows.length >= res.total || res.items.length === 0) break;
      page++;
    }
    return { rows, totalsByCurrency };
  }

  async exportExcel(
    data: ExportData,
    columns: ExportColumn[],
    filename: string,
    sheetName: string,
    totalLabel: string,
  ): Promise<void> {
    const XLSX = await import('xlsx');
    const header = columns.map((c) => c.header);
    const body = data.rows.map((e) => columns.map((c) => c.value(e)));
    const aoa: (string | number)[][] = [header, ...body];
    aoa.push([]);
    for (const ct of data.totalsByCurrency) {
      aoa.push([`${totalLabel} ${ct.currency}`, ct.total]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  async exportPdf(
    data: ExportData,
    columns: ExportColumn[],
    filename: string,
    title: string,
    totalLabel: string,
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleString(), 14, 21);
    doc.setTextColor(0);

    const totalsRows = data.totalsByCurrency.map((ct) => {
      const row = new Array<string>(columns.length).fill('');
      row[columns.length - 2] = `${totalLabel} ${ct.currency}`;
      row[columns.length - 1] = ct.total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return row;
    });

    autoTable(doc, {
      startY: 26,
      head: [columns.map((c) => c.header)],
      body: data.rows.map((e) => columns.map((c) => String(c.value(e)))),
      foot: totalsRows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [63, 81, 181] },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      columnStyles: { [columns.length - 1]: { halign: 'right' } },
      didDrawPage: () => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          String(page),
          doc.internal.pageSize.getWidth() - 14,
          doc.internal.pageSize.getHeight() - 8,
        );
        doc.setTextColor(0);
      },
    });

    doc.save(`${filename}.pdf`);
  }
}
