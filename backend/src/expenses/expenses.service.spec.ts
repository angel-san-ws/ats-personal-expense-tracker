import { Repository } from 'typeorm';
import { ExpensesService } from './expenses.service';
import { Expense } from './expense.entity';
import { AccountsService } from '../accounts/accounts.service';
import { ConceptsService } from '../concepts/concepts.service';
import { UsersService } from '../users/users.service';
import { RatesService } from '../rates/rates.service';
import { RateStampingService } from '../rates/rate-stamping.service';

describe('ExpensesService', () => {
  let expensesCreate: jest.Mock;
  let expensesSave: jest.Mock;
  let rawQuery: jest.Mock;
  /** Recorded where/andWhere SQL fragments and their params. */
  let whereClauses: string[];
  let queryParams: Record<string, unknown>;
  let service: ExpensesService;

  /** Chainable stub standing in for TypeORM's SelectQueryBuilder. */
  const queryBuilder = () => {
    const qb: Record<string, jest.Mock> = {};
    const capture = (sql: string, params?: Record<string, unknown>) => {
      whereClauses.push(sql);
      Object.assign(queryParams, params);
      return qb;
    };
    for (const m of [
      'leftJoin',
      'select',
      'addSelect',
      'groupBy',
      'addGroupBy',
      'orderBy',
      'addOrderBy',
      'offset',
      'limit',
      'setParameter',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.where = jest.fn(capture);
    qb.andWhere = jest.fn(capture);
    qb.getRawMany = jest.fn(() => Promise.resolve([]));
    qb.getRawOne = jest.fn(() => Promise.resolve({}));
    qb.getCount = jest.fn(() => Promise.resolve(0));
    return qb;
  };

  beforeEach(() => {
    whereClauses = [];
    queryParams = {};
    expensesCreate = jest.fn((e: Partial<Expense>) => e);
    expensesSave = jest.fn((e: Partial<Expense>) => Promise.resolve(e));
    rawQuery = jest.fn().mockResolvedValue([]);

    service = new ExpensesService(
      {
        createQueryBuilder: jest.fn(() => queryBuilder()),
        create: expensesCreate,
        save: expensesSave,
        query: rawQuery,
        manager: {},
      } as unknown as Repository<Expense>,
      {
        ensureBackfilled: jest.fn().mockResolvedValue(undefined),
        findOwned: jest.fn(),
      } as unknown as AccountsService,
      {
        getOrCreateMany: jest.fn((_m: unknown, _u: string, names: string[]) =>
          Promise.resolve({
            idByName: new Map(names.map((n) => [n, `concept-${n}`])),
          }),
        ),
        assignCategory: jest.fn(),
      } as unknown as ConceptsService,
      {
        findById: jest.fn().mockResolvedValue({ currency: 'GTQ' }),
      } as unknown as UsersService,
      {
        getRate: jest.fn().mockResolvedValue(1),
      } as unknown as RatesService,
      {} as RateStampingService,
    );
  });

  describe('create', () => {
    it('normalizes tags (trim, lowercase, dedupe, drop empties) and trims notes', async () => {
      await service.create('u1', {
        fecha: '2026-07-01',
        comercio: 'Hotel',
        valor: 100,
        tags: [' Vacation-2026 ', 'VACATION-2026', '', 'Trip'],
        notes: '  refund pending  ',
      });
      expect(expensesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['vacation-2026', 'trip'],
          notes: 'refund pending',
        }),
      );
    });

    it('stores no tags and a null note when omitted', async () => {
      await service.create('u1', {
        fecha: '2026-07-01',
        comercio: 'Hotel',
        valor: 100,
      });
      expect(expensesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [], notes: null }),
      );
    });
  });

  describe('findAll tag filtering', () => {
    it('filters by array overlap when tags are selected', async () => {
      await service.findAll('u1', { tags: ['vacation-2026', 'trip'] });
      expect(whereClauses).toContain('e.tags && :tags::text[]');
      expect(queryParams.tags).toEqual(['vacation-2026', 'trip']);
    });

    it('adds no tags clause when the filter is absent or empty', async () => {
      await service.findAll('u1', {});
      await service.findAll('u1', { tags: [] });
      expect(whereClauses).not.toContain('e.tags && :tags::text[]');
    });

    it('matches the free-text search against merchant OR notes', async () => {
      await service.findAll('u1', { search: 'hotel' });
      expect(whereClauses).toContain(
        '(e.comercio ILIKE :search OR e.notes ILIKE :search)',
      );
      expect(queryParams.search).toBe('%hotel%');
    });
  });

  describe('distinctTags', () => {
    it('returns the user-scoped tags with numeric usage counts', async () => {
      rawQuery.mockResolvedValue([
        { tag: 'vacation-2026', count: '3' },
        { tag: 'trip', count: '1' },
      ]);
      const tags = await service.distinctTags('u1');
      expect(rawQuery).toHaveBeenCalledWith(expect.any(String), ['u1']);
      expect(tags).toEqual([
        { tag: 'vacation-2026', count: 3 },
        { tag: 'trip', count: 1 },
      ]);
    });
  });
});
