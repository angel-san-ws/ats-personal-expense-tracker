import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ImportBatch } from './import-batch.entity';
import { Expense } from '../expenses/expense.entity';
import { ConceptsService } from '../concepts/concepts.service';
import { UsersService } from '../users/users.service';
import { RatesService } from '../rates/rates.service';
import { parseStatement, ParsedRow } from './excel-parser';

/**
 * A transaction's natural identity for de-duplication: the bank document
 * number plus date, amount and merchant. Re-importing the same statement (or an
 * overlapping one) therefore skips transactions that are already stored.
 */
function signature(r: {
  noDoc: string | null;
  fecha: string;
  valor: number;
  comercio: string;
  currency?: string | null;
}): string {
  const doc = (r.noDoc ?? '').trim();
  const amount = Number(r.valor).toFixed(2);
  const merchant = (r.comercio ?? '').trim().toUpperCase();
  const currency = (r.currency ?? '').trim().toUpperCase();
  return `${doc}|${r.fecha}|${amount}|${merchant}|${currency}`;
}

export interface ImportResult {
  batchId: string | null;
  filename: string;
  rowCount: number;
  paymentsImported: number;
  duplicatesSkipped: number;
  totalRows: number;
  newConcepts: number;
  /** Concepts auto-assigned a category from the merchant name (0 when the option is off). */
  autoCategorized: number;
  metadata: {
    cardholderName: string | null;
    cardNumber: string | null;
    creditLimit: number | null;
    availableLimit: number | null;
    pastDueBalance: number | null;
    minimumPayment: number | null;
    statementDate: string | null;
    paymentDueDate: string | null;
  };
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly concepts: ConceptsService,
    private readonly users: UsersService,
    private readonly rates: RatesService,
  ) {}

  async importExcel(
    userId: string,
    filename: string,
    buffer: Buffer,
    suggestCategories = false,
  ): Promise<ImportResult> {
    let parsed;
    try {
      parsed = parseStatement(buffer);
    } catch (err) {
      throw new BadRequestException(
        `Could not read the file: ${(err as Error).message}`,
      );
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException(
        'No transactions were found in the file. Check the format.',
      );
    }

    const totalRows = parsed.rows.length;

    // Resolve each row's currency: detected symbol → file's majority → user default.
    const user = await this.users.findById(userId);
    const userCurrency = user.currency || 'GTQ';
    const counts = new Map<string, number>();
    for (const r of parsed.rows) {
      if (r.currency) counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
    }
    let majority: string | null = null;
    let best = 0;
    for (const [c, n] of counts) {
      if (n > best) {
        best = n;
        majority = c;
      }
    }
    for (const r of parsed.rows) {
      r.currency = r.currency ?? majority ?? userCurrency;
    }

    // Prefetch exchange rates to the user's base currency per foreign
    // currency. HTTP must stay outside the DB transaction below; failures
    // leave rows unstamped (NULL rate) and never block the import.
    const rateByKey = new Map<string, number>();
    const rangeByCurrency = new Map<string, { min: string; max: string }>();
    for (const r of parsed.rows) {
      const currency = r.currency;
      if (!currency || currency === userCurrency) continue;
      const range = rangeByCurrency.get(currency);
      if (!range) {
        rangeByCurrency.set(currency, { min: r.fecha, max: r.fecha });
      } else {
        if (r.fecha < range.min) range.min = r.fecha;
        if (r.fecha > range.max) range.max = r.fecha;
      }
    }
    for (const [currency, { min, max }] of rangeByCurrency) {
      try {
        const byDate = await this.rates.getRatesForRange(
          currency,
          userCurrency,
          min,
          max,
        );
        for (const [date, rate] of byDate) {
          rateByKey.set(`${currency}|${date}`, rate);
        }
      } catch (err) {
        this.logger.warn(
          `Rate prefetch ${currency}->${userCurrency} failed: ${(err as Error).message}`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // --- Idempotency: skip transactions already stored for this user. ---
      const existing = await manager
        .getRepository(Expense)
        .createQueryBuilder('e')
        .select(['e.noDoc', 'e.fecha', 'e.valor', 'e.comercio', 'e.currency'])
        .where('e.user_id = :userId', { userId })
        .getMany();

      const seen = new Set(existing.map(signature));

      const freshRows: ParsedRow[] = [];
      let duplicatesSkipped = 0;
      for (const r of parsed.rows) {
        const sig = signature(r);
        if (seen.has(sig)) {
          duplicatesSkipped++;
          continue;
        }
        seen.add(sig); // also dedupe within the same file
        freshRows.push(r);
      }

      // Nothing new — don't create an empty batch.
      if (freshRows.length === 0) {
        this.logger.log(
          `Import for user ${userId}: 0 new rows, ${duplicatesSkipped} duplicates skipped`,
        );
        return {
          batchId: null,
          filename,
          rowCount: 0,
          paymentsImported: 0,
          duplicatesSkipped,
          totalRows,
          newConcepts: 0,
          autoCategorized: 0,
          metadata: parsed.metadata,
        };
      }

      const batch = manager.create(ImportBatch, {
        userId,
        filename,
        rowCount: freshRows.length,
        cardholderName: parsed.metadata.cardholderName,
        cardNumber: parsed.metadata.cardNumber,
        creditLimit: parsed.metadata.creditLimit,
        availableLimit: parsed.metadata.availableLimit,
        pastDueBalance: parsed.metadata.pastDueBalance,
        minimumPayment: parsed.metadata.minimumPayment,
        statementDate: parsed.metadata.statementDate,
        paymentDueDate: parsed.metadata.paymentDueDate,
      });
      const savedBatch = await manager.save(batch);

      // Only real expenses get a categorizable concept; payments do not.
      const { idByName, createdNames } = await this.concepts.getOrCreateMany(
        manager,
        userId,
        freshRows.filter((r) => r.kind === 'expense').map((r) => r.comercio),
      );

      const autoCategorized = suggestCategories
        ? (
            await this.concepts.autoCategorize(userId, {
              manager,
              conceptIds: [...idByName.values()],
            })
          ).assigned
        : 0;

      const expenses = freshRows.map((r) =>
        manager.create(Expense, {
          userId,
          fecha: r.fecha,
          tarjeta: r.tarjeta,
          noTarjeta: r.noTarjeta,
          nombre: r.nombre,
          tipoMovimiento: r.tipoMovimiento,
          noDoc: r.noDoc,
          comercio: r.comercio,
          valor: r.valor,
          saldo: r.saldo,
          kind: r.kind,
          currency: r.currency ?? userCurrency,
          exchangeRate:
            (r.currency ?? userCurrency) === userCurrency
              ? 1
              : (rateByKey.get(`${r.currency}|${r.fecha}`) ?? null),
          conceptId:
            r.kind === 'expense' ? (idByName.get(r.comercio) ?? null) : null,
          importBatchId: savedBatch.id,
        }),
      );

      await manager.save(Expense, expenses, { chunk: 200 });

      this.logger.log(
        `Imported ${expenses.length} expenses for user ${userId} ` +
          `(${createdNames.length} new concepts, ${duplicatesSkipped} duplicates skipped, ` +
          `${autoCategorized} concepts auto-categorized)`,
      );

      return {
        batchId: savedBatch.id,
        filename,
        rowCount: freshRows.length,
        paymentsImported: freshRows.filter((r) => r.kind === 'payment').length,
        duplicatesSkipped,
        totalRows,
        newConcepts: createdNames.length,
        autoCategorized,
        metadata: parsed.metadata,
      };
    });
  }

  listBatches(userId: string): Promise<ImportBatch[]> {
    return this.dataSource.getRepository(ImportBatch).find({
      where: { userId },
      order: { importedAt: 'DESC' },
    });
  }

  /**
   * Delete an import batch together with every expense/payment it created.
   * The FK already cascades, but deleting explicitly inside a transaction
   * lets us report how many transactions were removed.
   */
  async deleteBatch(
    userId: string,
    batchId: string,
  ): Promise<{ deletedExpenses: number }> {
    return this.dataSource.transaction(async (manager) => {
      const batch = await manager
        .getRepository(ImportBatch)
        .findOne({ where: { id: batchId, userId } });
      if (!batch) {
        throw new NotFoundException('Import batch not found.');
      }

      const { affected } = await manager
        .getRepository(Expense)
        .delete({ importBatchId: batchId, userId });
      await manager.getRepository(ImportBatch).delete(batch.id);

      this.logger.log(
        `Deleted import batch ${batchId} (${batch.filename}) for user ${userId}: ` +
          `${affected ?? 0} transactions removed`,
      );
      return { deletedExpenses: affected ?? 0 };
    });
  }
}
