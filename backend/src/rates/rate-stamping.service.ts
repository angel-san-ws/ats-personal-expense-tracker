import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../expenses/expense.entity';
import { RatesService } from './rates.service';

export interface StampResult {
  /** Rows that received a rate in this run. */
  stamped: number;
  /** Foreign-currency rows still pending conversion. */
  remaining: number;
}

/**
 * Backfills `expenses.exchange_rate` (rate from the expense currency to the
 * user's base currency at the expense `fecha`). Serves as the initial
 * backfill, the retry after provider outages, and the recompute after a
 * base-currency change.
 */
@Injectable()
export class RateStampingService {
  private readonly logger = new Logger(RateStampingService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly rates: RatesService,
  ) {}

  /** Stamp every NULL-rate row of the user (all kinds, payments included). */
  async stampPending(userId: string, base: string): Promise<StampResult> {
    // Base-currency rows convert 1:1.
    const baseResult = await this.expenses
      .createQueryBuilder()
      .update(Expense)
      .set({ exchangeRate: 1 })
      .where('user_id = :userId', { userId })
      .andWhere('exchange_rate IS NULL')
      .andWhere('currency = :base', { base })
      .execute();
    let stamped = baseResult.affected ?? 0;

    // Distinct (currency, fecha) pairs still pending.
    const pendingRaw: { currency: string; fecha: string }[] =
      await this.expenses
        .createQueryBuilder('e')
        .select('e.currency', 'currency')
        .addSelect("to_char(e.fecha, 'YYYY-MM-DD')", 'fecha')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.exchange_rate IS NULL')
        .groupBy('e.currency')
        .addGroupBy('e.fecha')
        .getRawMany();

    const datesByCurrency = new Map<string, string[]>();
    for (const row of pendingRaw) {
      let dates = datesByCurrency.get(row.currency);
      if (!dates) datesByCurrency.set(row.currency, (dates = []));
      dates.push(row.fecha);
    }

    for (const [currency, dates] of datesByCurrency) {
      dates.sort();
      const rateByDate = await this.rates.getRatesForRange(
        currency,
        base,
        dates[0],
        dates[dates.length - 1],
      );
      const stampDates: string[] = [];
      const stampRates: number[] = [];
      for (const date of dates) {
        const rate = rateByDate.get(date);
        if (rate !== undefined) {
          stampDates.push(date);
          stampRates.push(rate);
        }
      }
      if (stampDates.length === 0) continue;
      // The postgres driver returns [rows, rowCount] for raw UPDATEs.
      const [, affected] = (await this.expenses.query(
        `UPDATE expenses e
            SET exchange_rate = v.rate
           FROM (SELECT unnest($3::date[]) AS fecha,
                        unnest($4::numeric[]) AS rate) v
          WHERE e.user_id = $1
            AND e.exchange_rate IS NULL
            AND e.currency = $2
            AND e.fecha = v.fecha`,
        [userId, currency, stampDates, stampRates],
      )) as [unknown[], number];
      stamped += affected ?? 0;
    }

    const remaining = await this.expenses
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.exchange_rate IS NULL')
      .andWhere('e.currency != :base', { base })
      .getCount();

    return { stamped, remaining };
  }

  /**
   * Recompute all of the user's rates against a (new) base currency. The
   * NULL-out is immediate; the re-stamp is best-effort — leftovers surface
   * through the dashboard's pending-conversion banner.
   */
  async restampAll(userId: string, base: string): Promise<StampResult> {
    await this.expenses
      .createQueryBuilder()
      .update(Expense)
      .set({ exchangeRate: null })
      .where('user_id = :userId', { userId })
      .execute();
    try {
      return await this.stampPending(userId, base);
    } catch (err) {
      this.logger.warn(
        `restamp failed for user ${userId}: ${(err as Error).message}`,
      );
      const remaining = await this.expenses
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.exchange_rate IS NULL')
        .andWhere('e.currency != :base', { base })
        .getCount();
      return { stamped: 0, remaining };
    }
  }
}
