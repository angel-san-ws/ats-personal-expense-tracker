import { Repository } from 'typeorm';
import { BudgetsService } from './budgets.service';
import { Budget } from './budget.entity';
import { Expense } from '../expenses/expense.entity';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';

describe('BudgetsService', () => {
  let budgetsFind: jest.Mock;
  let budgetsFindOne: jest.Mock;
  let budgetsSave: jest.Mock;
  let budgetsCreate: jest.Mock;
  let categoriesFindAll: jest.Mock;
  let categoriesFindOne: jest.Mock;
  let spentRows: { categoryId: string | null; spent: string }[];
  let unconvertedCount: number;
  /** Recorded where/andWhere params so tests can assert the date window. */
  let queryParams: Record<string, unknown>;
  let service: BudgetsService;

  /** Chainable stub standing in for TypeORM's SelectQueryBuilder. */
  const queryBuilder = () => {
    const qb: Record<string, jest.Mock> = {};
    const capture = (_sql: string, params?: Record<string, unknown>) => {
      Object.assign(queryParams, params);
      return qb;
    };
    for (const m of ['leftJoin', 'select', 'addSelect', 'groupBy']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.where = jest.fn(capture);
    qb.andWhere = jest.fn(capture);
    qb.setParameter = jest.fn((name: string, value: unknown) => {
      queryParams[name] = value;
      return qb;
    });
    qb.getRawMany = jest.fn(() => Promise.resolve(spentRows));
    qb.getCount = jest.fn(() => Promise.resolve(unconvertedCount));
    return qb;
  };

  beforeEach(() => {
    budgetsFind = jest.fn().mockResolvedValue([]);
    budgetsFindOne = jest.fn().mockResolvedValue(null);
    budgetsSave = jest.fn((b: Partial<Budget>) => Promise.resolve(b));
    budgetsCreate = jest.fn((b: Partial<Budget>) => b);
    categoriesFindAll = jest.fn().mockResolvedValue([]);
    categoriesFindOne = jest.fn().mockResolvedValue({ id: 'cat-1' });
    spentRows = [];
    unconvertedCount = 0;
    queryParams = {};

    service = new BudgetsService(
      {
        find: budgetsFind,
        findOne: budgetsFindOne,
        save: budgetsSave,
        create: budgetsCreate,
        remove: jest.fn(),
      } as unknown as Repository<Budget>,
      {
        createQueryBuilder: jest.fn(() => queryBuilder()),
      } as unknown as Repository<Expense>,
      {
        findAll: categoriesFindAll,
        findOne: categoriesFindOne,
      } as unknown as CategoriesService,
      {
        findById: jest.fn().mockResolvedValue({ currency: 'GTQ' }),
      } as unknown as UsersService,
    );
  });

  describe('upsert', () => {
    it('creates a budget when none exists for the category', async () => {
      await service.upsert('u1', { categoryId: 'cat-1', amount: 500 });
      expect(categoriesFindOne).toHaveBeenCalledWith('u1', 'cat-1');
      expect(budgetsCreate).toHaveBeenCalledWith({
        userId: 'u1',
        categoryId: 'cat-1',
        month: null,
        amount: 500,
      });
    });

    it('targets the month override row, not the standing budget', async () => {
      await service.upsert('u1', {
        categoryId: 'cat-1',
        amount: 800,
        month: '2026-07',
      });
      expect(budgetsFindOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ month: '2026-07' }) as object,
      });
      expect(budgetsCreate).toHaveBeenCalledWith({
        userId: 'u1',
        categoryId: 'cat-1',
        month: '2026-07',
        amount: 800,
      });
    });

    it('replaces the amount of an existing budget', async () => {
      budgetsFindOne.mockResolvedValue({ id: 'b1', amount: 100 });
      await service.upsert('u1', { categoryId: 'cat-1', amount: 750 });
      expect(budgetsCreate).not.toHaveBeenCalled();
      expect(budgetsSave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1', amount: 750 }),
      );
    });

    it('treats a missing categoryId as the overall budget', async () => {
      await service.upsert('u1', { amount: 3000 });
      expect(categoriesFindOne).not.toHaveBeenCalled();
      expect(budgetsCreate).toHaveBeenCalledWith({
        userId: 'u1',
        categoryId: null,
        month: null,
        amount: 3000,
      });
    });
  });

  describe('status', () => {
    it('queries a half-open month window (handles December rollover)', async () => {
      await service.status('u1', { month: '2026-12' });
      expect(queryParams.from).toBe('2026-12-01');
      expect(queryParams.to).toBe('2027-01-01');
    });

    it('joins spent, budgets and categories per category', async () => {
      categoriesFindAll.mockResolvedValue([
        { id: 'cat-1', name: 'Food', color: '#f00' },
        { id: 'cat-2', name: 'Transport', color: '#0f0' },
      ]);
      budgetsFind.mockResolvedValue([
        { id: 'b1', categoryId: 'cat-1', amount: 500 },
      ]);
      spentRows = [
        { categoryId: 'cat-1', spent: '320.50' },
        { categoryId: null, spent: '80' }, // uncategorized
      ];

      const status = await service.status('u1', { month: '2026-07' });

      expect(status.categories).toEqual([
        {
          categoryId: 'cat-1',
          categoryName: 'Food',
          color: '#f00',
          budgetId: 'b1',
          amount: 500,
          overrideId: null,
          overrideAmount: null,
          effectiveAmount: 500,
          spent: 320.5,
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Transport',
          color: '#0f0',
          budgetId: null,
          amount: null,
          overrideId: null,
          overrideAmount: null,
          effectiveAmount: null,
          spent: 0,
        },
      ]);
      // Overall spend includes uncategorized rows; no overall budget set.
      expect(status.overall).toEqual({
        budgetId: null,
        amount: null,
        overrideId: null,
        overrideAmount: null,
        effectiveAmount: null,
        spent: 400.5,
      });
    });

    it('surfaces the overall budget (NULL category) and unconverted count', async () => {
      budgetsFind.mockResolvedValue([
        { id: 'b-all', categoryId: null, amount: 10000 },
      ]);
      spentRows = [{ categoryId: null, spent: '1234' }];
      unconvertedCount = 3;

      const status = await service.status('u1', { month: '2026-07' });

      expect(status.overall).toEqual({
        budgetId: 'b-all',
        amount: 10000,
        overrideId: null,
        overrideAmount: null,
        effectiveAmount: 10000,
        spent: 1234,
      });
      expect(status.unconvertedCount).toBe(3);
      expect(status.baseCurrency).toBe('GTQ');
    });

    it('applies a month override on top of the standing budget', async () => {
      categoriesFindAll.mockResolvedValue([
        { id: 'cat-1', name: 'Food', color: '#f00' },
      ]);
      budgetsFind.mockResolvedValue([
        { id: 'b1', categoryId: 'cat-1', month: null, amount: 500 },
        { id: 'o1', categoryId: 'cat-1', month: '2026-07', amount: 800 },
        { id: 'o2', categoryId: 'cat-1', month: '2026-08', amount: 200 },
        { id: 'o-all', categoryId: null, month: '2026-07', amount: 9000 },
      ]);

      const status = await service.status('u1', { month: '2026-07' });

      // The viewed month's override wins; other months' overrides are ignored.
      expect(status.categories[0]).toMatchObject({
        budgetId: 'b1',
        amount: 500,
        overrideId: 'o1',
        overrideAmount: 800,
        effectiveAmount: 800,
      });
      // An override without a standing budget still sets the effective limit.
      expect(status.overall).toMatchObject({
        budgetId: null,
        amount: null,
        overrideId: 'o-all',
        overrideAmount: 9000,
        effectiveAmount: 9000,
      });
    });

    it('defaults to the current month', async () => {
      const status = await service.status('u1', {});
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(status.month).toBe(expected);
    });
  });
});
