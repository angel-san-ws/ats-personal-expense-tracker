import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { BanguatProvider } from './providers/banguat.provider';
import { FrankfurterProvider } from './providers/frankfurter.provider';

/** Max days to look back for the most recent published rate. */
const LOOKBACK_DAYS = 7;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Forward-fill published rates onto every calendar date in [minIso, maxIso],
 * carrying the most recent published rate for up to LOOKBACK_DAYS.
 */
function forwardFill(
  published: Map<string, number>,
  minIso: string,
  maxIso: string,
): Map<string, number> {
  const filled = new Map<string, number>();
  let last: number | null = null;
  let age = LOOKBACK_DAYS + 1;
  for (
    let d = addDays(minIso, -LOOKBACK_DAYS);
    d <= maxIso;
    d = addDays(d, 1)
  ) {
    const rate = published.get(d);
    if (rate !== undefined) {
      last = rate;
      age = 0;
    } else {
      age++;
    }
    if (d >= minIso && last !== null && age <= LOOKBACK_DAYS) {
      filled.set(d, last);
    }
  }
  return filled;
}

/**
 * Resolves exchange rates between the app's supported currencies, backed by
 * the shared `exchange_rates` cache. Only USD legs are cached
 * (base 'USD' → quote X, units of X per 1 USD); cross rates are derived as
 * rate(from → to) = perUsd(to) / perUsd(from).
 */
@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly cache: Repository<ExchangeRate>,
    private readonly banguat: BanguatProvider,
    private readonly frankfurter: FrankfurterProvider,
  ) {}

  /**
   * Rate from `from` to `to` on `dateIso` (most recent published rate up to
   * LOOKBACK_DAYS earlier). Null when unresolvable; never throws.
   */
  async getRate(
    dateIso: string,
    from: string,
    to: string,
  ): Promise<number | null> {
    if (from === to) return 1;
    try {
      const rates = await this.getRatesForRange(from, to, dateIso, dateIso);
      return rates.get(dateIso) ?? null;
    } catch (err) {
      this.logger.warn(
        `getRate ${from}->${to} failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Rates from `from` to `to` for every calendar date in [minIso, maxIso]
   * (weekend/holiday gaps forward-filled). Dates whose rate cannot be
   * resolved are absent from the result.
   */
  async getRatesForRange(
    from: string,
    to: string,
    minIso: string,
    maxIso: string,
  ): Promise<Map<string, number>> {
    if (from === to) {
      const ones = new Map<string, number>();
      for (let d = minIso; d <= maxIso; d = addDays(d, 1)) ones.set(d, 1);
      return ones;
    }
    const [fromLeg, toLeg] = await Promise.all([
      this.perUsdFilled(from, minIso, maxIso),
      this.perUsdFilled(to, minIso, maxIso),
    ]);
    const rates = new Map<string, number>();
    for (const [date, fromRate] of fromLeg) {
      const toRate = toLeg.get(date);
      if (toRate !== undefined && fromRate > 0) {
        rates.set(date, toRate / fromRate);
      }
    }
    return rates;
  }

  /** Units of `currency` per 1 USD, forward-filled over [minIso, maxIso]. */
  private async perUsdFilled(
    currency: string,
    minIso: string,
    maxIso: string,
  ): Promise<Map<string, number>> {
    if (currency === 'USD') {
      const ones = new Map<string, number>();
      for (let d = minIso; d <= maxIso; d = addDays(d, 1)) ones.set(d, 1);
      return ones;
    }
    const fetchFrom = addDays(minIso, -LOOKBACK_DAYS);

    const cachedRows = await this.cache.find({
      where: { base: 'USD', quote: currency, date: Between(fetchFrom, maxIso) },
    });
    const published = new Map(cachedRows.map((r) => [r.date, r.rate]));

    let filled = forwardFill(published, minIso, maxIso);
    if (this.covers(filled, minIso, maxIso)) return filled;

    const fetched =
      currency === 'GTQ'
        ? await this.banguat.fetchGtqPerUsdRange(fetchFrom, maxIso)
        : ((
            await this.frankfurter.fetchPerUsdRange(
              [currency],
              fetchFrom,
              maxIso,
            )
          ).get(currency) ?? new Map<string, number>());

    const newRows = [...fetched]
      .filter(([date]) => !published.has(date))
      .map(([date, rate]) => ({ date, base: 'USD', quote: currency, rate }));
    if (newRows.length > 0) {
      try {
        await this.cache.upsert(newRows, ['date', 'base', 'quote']);
      } catch (err) {
        this.logger.warn(`rate cache upsert failed: ${(err as Error).message}`);
      }
      for (const [date, rate] of fetched) published.set(date, rate);
      filled = forwardFill(published, minIso, maxIso);
    }
    return filled;
  }

  /** Whether every calendar date in [minIso, maxIso] has a resolved rate. */
  private covers(
    filled: Map<string, number>,
    minIso: string,
    maxIso: string,
  ): boolean {
    for (let d = minIso; d <= maxIso; d = addDays(d, 1)) {
      if (!filled.has(d)) return false;
    }
    return true;
  }
}
