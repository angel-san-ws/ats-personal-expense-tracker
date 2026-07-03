import { Repository } from 'typeorm';
import { RatesService } from './rates.service';
import { ExchangeRate } from './exchange-rate.entity';
import { BanguatProvider } from './providers/banguat.provider';
import { FrankfurterProvider } from './providers/frankfurter.provider';

describe('RatesService', () => {
  let cacheFind: jest.Mock;
  let cacheUpsert: jest.Mock;
  let banguatFetch: jest.Mock;
  let frankfurterFetch: jest.Mock;
  let service: RatesService;

  /** frankfurter result shape: currency -> (date -> units per USD). */
  const perUsd = (currency: string, rates: Record<string, number>) =>
    new Map([[currency, new Map(Object.entries(rates))]]);

  beforeEach(() => {
    cacheFind = jest.fn().mockResolvedValue([]);
    cacheUpsert = jest.fn().mockResolvedValue(undefined);
    banguatFetch = jest.fn().mockResolvedValue(new Map());
    frankfurterFetch = jest.fn().mockResolvedValue(new Map());

    service = new RatesService(
      {
        find: cacheFind,
        upsert: cacheUpsert,
      } as unknown as Repository<ExchangeRate>,
      { fetchGtqPerUsdRange: banguatFetch } as unknown as BanguatProvider,
      { fetchPerUsdRange: frankfurterFetch } as unknown as FrankfurterProvider,
    );
  });

  it('returns 1 for same-currency conversions', async () => {
    await expect(service.getRate('2026-06-05', 'USD', 'USD')).resolves.toBe(1);
    expect(banguatFetch).not.toHaveBeenCalled();
    expect(frankfurterFetch).not.toHaveBeenCalled();
  });

  it('USD -> GTQ equals the Banguat GTQ-per-USD rate (inversion guard)', async () => {
    banguatFetch.mockResolvedValue(new Map([['2026-06-05', 7.8]]));
    await expect(service.getRate('2026-06-05', 'USD', 'GTQ')).resolves.toBe(
      7.8,
    );
  });

  it('GTQ -> USD is the inverse of the Banguat rate', async () => {
    banguatFetch.mockResolvedValue(new Map([['2026-06-05', 7.8]]));
    const rate = await service.getRate('2026-06-05', 'GTQ', 'USD');
    expect(rate).toBeCloseTo(1 / 7.8, 8);
  });

  it('cross-rates EUR -> GTQ through USD legs', async () => {
    banguatFetch.mockResolvedValue(new Map([['2026-06-05', 7.8]]));
    frankfurterFetch.mockResolvedValue(perUsd('EUR', { '2026-06-05': 0.92 }));
    const rate = await service.getRate('2026-06-05', 'EUR', 'GTQ');
    expect(rate).toBeCloseTo(7.8 / 0.92, 8); // ≈ 8.478
  });

  it('falls back to the most recent published rate within 7 days', async () => {
    // Published Friday only; Sunday resolves to Friday's rate.
    banguatFetch.mockResolvedValue(new Map([['2026-06-05', 7.8]]));
    await expect(service.getRate('2026-06-07', 'USD', 'GTQ')).resolves.toBe(
      7.8,
    );
  });

  it('returns null when no rate was published within the 7-day lookback', async () => {
    banguatFetch.mockResolvedValue(new Map([['2026-05-20', 7.8]]));
    await expect(
      service.getRate('2026-06-05', 'USD', 'GTQ'),
    ).resolves.toBeNull();
  });

  it('returns null (without throwing) when providers are unreachable', async () => {
    await expect(
      service.getRate('2026-06-05', 'USD', 'GTQ'),
    ).resolves.toBeNull();
    await expect(
      service.getRate('2026-06-05', 'EUR', 'GTQ'),
    ).resolves.toBeNull();
  });

  it('forward-fills gaps across the requested range', async () => {
    banguatFetch.mockResolvedValue(
      new Map([
        ['2026-06-01', 7.7],
        ['2026-06-04', 7.9],
      ]),
    );
    const rates = await service.getRatesForRange(
      'USD',
      'GTQ',
      '2026-06-01',
      '2026-06-05',
    );
    expect(Object.fromEntries(rates)).toEqual({
      '2026-06-01': 7.7,
      '2026-06-02': 7.7,
      '2026-06-03': 7.7,
      '2026-06-04': 7.9,
      '2026-06-05': 7.9,
    });
  });

  it('serves fully cached ranges without calling providers, and caches fetched rates', async () => {
    cacheFind.mockResolvedValue([
      { date: '2026-06-04', base: 'USD', quote: 'GTQ', rate: 7.8 },
    ]);
    await expect(service.getRate('2026-06-05', 'USD', 'GTQ')).resolves.toBe(
      7.8,
    );
    expect(banguatFetch).not.toHaveBeenCalled();

    cacheFind.mockResolvedValue([]);
    banguatFetch.mockResolvedValue(new Map([['2026-06-05', 7.85]]));
    await expect(service.getRate('2026-06-05', 'USD', 'GTQ')).resolves.toBe(
      7.85,
    );
    expect(cacheUpsert).toHaveBeenCalledWith(
      [{ date: '2026-06-05', base: 'USD', quote: 'GTQ', rate: 7.85 }],
      ['date', 'base', 'quote'],
    );
  });
});
