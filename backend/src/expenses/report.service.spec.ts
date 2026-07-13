import { Repository } from 'typeorm';
import { ReportService } from './report.service';
import { Expense } from './expense.entity';
import { BudgetsService } from '../budgets/budgets.service';
import { UsersService } from '../users/users.service';

describe('ReportService', () => {
  /** Raw results returned by getRawMany, consumed in query-creation order:
   *  [year month totals, previous-year month totals, category × month]. */
  let rawManyQueue: unknown[][];
  let unconvertedCount: number;
  let monthlyLimits: jest.Mock;
  /** Params captured per created query builder, in creation order. */
  let capturedParams: Record<string, unknown>[];
  let service: ReportService;

  /** Chainable stub standing in for TypeORM's SelectQueryBuilder. */
  const queryBuilder = () => {
    const params: Record<string, unknown> = {};
    capturedParams.push(params);
    const qb: Record<string, jest.Mock> = {};
    const capture = (_sql: string, p?: Record<string, unknown>) => {
      Object.assign(params, p);
      return qb;
    };
    for (const m of [
      'leftJoin',
      'select',
      'addSelect',
      'groupBy',
      'addGroupBy',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.where = jest.fn(capture);
    qb.andWhere = jest.fn(capture);
    qb.setParameter = jest.fn((name: string, value: unknown) => {
      params[name] = value;
      return qb;
    });
    qb.getRawMany = jest.fn(() => Promise.resolve(rawManyQueue.shift() ?? []));
    qb.getCount = jest.fn(() => Promise.resolve(unconvertedCount));
    return qb;
  };

  const noLimits = (year: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      month: `${year}-${String(i + 1).padStart(2, '0')}`,
      limit: null,
    }));

  beforeEach(() => {
    rawManyQueue = [];
    unconvertedCount = 0;
    capturedParams = [];
    monthlyLimits = jest.fn((_userId: string, year: number) =>
      Promise.resolve(noLimits(year)),
    );

    service = new ReportService(
      {
        createQueryBuilder: jest.fn(() => queryBuilder()),
      } as unknown as Repository<Expense>,
      {
        findById: jest.fn().mockResolvedValue({ currency: 'GTQ' }),
      } as unknown as UsersService,
      { monthlyLimits } as unknown as BudgetsService,
    );
  });

  it('builds 12 buckets aligning previous-year totals and budget limits', async () => {
    rawManyQueue = [
      [
        { month: '2026-01', total: '100.50', count: '3' },
        { month: '2026-03', total: '50', count: '1' },
      ],
      [{ month: '2025-01', total: '80', count: '2' }],
      [],
    ];
    monthlyLimits.mockResolvedValue([
      { month: '2026-01', limit: 500 },
      ...noLimits(2026).slice(1),
    ]);

    const report = await service.yearReport('u1', { year: 2026 });

    expect(report.months).toHaveLength(12);
    expect(report.months[0]).toEqual({
      month: '2026-01',
      total: 100.5,
      count: 3,
      prevTotal: 80,
      budget: 500,
    });
    // Months without rows still appear, zero-filled and without a budget.
    expect(report.months[1]).toEqual({
      month: '2026-02',
      total: 0,
      count: 0,
      prevTotal: 0,
      budget: null,
    });
    expect(report.months[2].total).toBe(50);
    expect(monthlyLimits).toHaveBeenCalledWith('u1', 2026);
  });

  it('computes year total, previous-year total and average over months with spend', async () => {
    rawManyQueue = [
      [
        { month: '2026-01', total: '100.50', count: '3' },
        { month: '2026-03', total: '50', count: '1' },
      ],
      [
        { month: '2025-04', total: '80', count: '2' },
        { month: '2025-12', total: '20', count: '1' },
      ],
      [],
    ];
    unconvertedCount = 4;

    const report = await service.yearReport('u1', { year: 2026 });

    expect(report.yearTotal).toBe(150.5);
    expect(report.prevYearTotal).toBe(100);
    // Two months carry spend, so the average is over 2, not 12.
    expect(report.monthlyAverage).toBeCloseTo(75.25);
    expect(report.unconvertedCount).toBe(4);
    expect(report.baseCurrency).toBe('GTQ');
  });

  it('returns zeros instead of dividing by zero for an empty year', async () => {
    const report = await service.yearReport('u1', { year: 2026 });
    expect(report.yearTotal).toBe(0);
    expect(report.monthlyAverage).toBe(0);
    expect(report.byCategory).toEqual([]);
  });

  it('pivots category rows into 12-slot series ordered by year total', async () => {
    rawManyQueue = [
      [],
      [],
      [
        {
          categoryId: 'c1',
          categoryName: 'Food',
          color: '#f00',
          month: '2026-01',
          total: '100',
        },
        {
          categoryId: 'c1',
          categoryName: 'Food',
          color: '#f00',
          month: '2026-02',
          total: '50',
        },
        {
          categoryId: null,
          categoryName: null,
          color: null,
          month: '2026-01',
          total: '200',
        },
      ],
    ];

    const report = await service.yearReport('u1', { year: 2026 });

    expect(report.byCategory).toEqual([
      {
        categoryId: null,
        categoryName: 'Uncategorized',
        color: '#9ca3af',
        monthlyTotals: [200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 200,
      },
      {
        categoryId: 'c1',
        categoryName: 'Food',
        color: '#f00',
        monthlyTotals: [100, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 150,
      },
    ]);
  });

  it('queries half-open year windows for the year and the previous year', async () => {
    await service.yearReport('u1', { year: 2026 });

    // Builders are created in Promise.all order: year, previous year, …
    expect(capturedParams[0]).toMatchObject({
      userId: 'u1',
      from: '2026-01-01',
      to: '2027-01-01',
      base: 'GTQ',
    });
    expect(capturedParams[1]).toMatchObject({
      from: '2025-01-01',
      to: '2026-01-01',
    });
  });

  it('defaults to the current year when none is given', async () => {
    const report = await service.yearReport('u1', {});
    const year = new Date().getFullYear();
    expect(report.year).toBe(year);
    expect(monthlyLimits).toHaveBeenCalledWith('u1', year);
  });
});
