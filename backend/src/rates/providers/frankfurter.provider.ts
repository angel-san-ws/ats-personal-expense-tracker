import { Injectable, Logger } from '@nestjs/common';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1';

interface FrankfurterRangeResponse {
  rates?: Record<string, Record<string, number>>;
}

/**
 * frankfurter.dev — free keyless ECB historical rates. No GTQ (Banguat
 * covers it) and only ECB business days (gaps are forward-filled by the
 * caller).
 */
@Injectable()
export class FrankfurterProvider {
  private readonly logger = new Logger(FrankfurterProvider.name);

  /**
   * Fetch units-per-USD for the given currencies over an inclusive ISO date
   * range. Returns currency → (ISO date → rate); empty on any failure
   * (never throws).
   */
  async fetchPerUsdRange(
    currencies: string[],
    fromIso: string,
    toIso: string,
  ): Promise<Map<string, Map<string, number>>> {
    const result = new Map<string, Map<string, number>>();
    if (currencies.length === 0) return result;
    const url =
      `${FRANKFURTER_URL}/${fromIso}..${toIso}` +
      `?from=USD&to=${currencies.join(',')}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`frankfurter responded ${res.status}`);
        return result;
      }
      const body = (await res.json()) as FrankfurterRangeResponse;
      for (const [date, byCurrency] of Object.entries(body.rates ?? {})) {
        for (const [currency, rate] of Object.entries(byCurrency)) {
          if (!Number.isFinite(rate) || rate <= 0) continue;
          let dates = result.get(currency);
          if (!dates) result.set(currency, (dates = new Map<string, number>()));
          dates.set(date, rate);
        }
      }
    } catch (err) {
      this.logger.warn(`frankfurter fetch failed: ${(err as Error).message}`);
    }
    return result;
  }
}
