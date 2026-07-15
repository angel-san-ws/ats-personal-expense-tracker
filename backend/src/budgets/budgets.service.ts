import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Budget } from './budget.entity';
import { Expense } from '../expenses/expense.entity';
import { CONVERTED } from '../expenses/expenses.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { BudgetStatusQueryDto, UpsertBudgetDto } from './dto';

/** The limits that apply to one target (a category or the overall budget). */
export interface BudgetLimit {
  /** Standing budget row; null when none is set. */
  budgetId: string | null;
  /** Standing monthly limit in the base currency; null when none is set. */
  amount: number | null;
  /** Override row for the requested month; null when none is set. */
  overrideId: string | null;
  /** Override amount for the requested month; null when none is set. */
  overrideAmount: number | null;
  /** The limit in effect for the month: override, else the standing amount. */
  effectiveAmount: number | null;
}

export interface BudgetCategoryStatus extends BudgetLimit {
  categoryId: string;
  categoryName: string;
  color: string;
  /** Spend for the month, converted to the base currency. */
  spent: number;
  /**
   * Portion of `spent` generated from recurring expense templates — fixed
   * amounts that won't repeat within the month, so pace projections should
   * count them at face value instead of extrapolating them.
   */
  recurringSpent: number;
}

export interface BudgetStatus {
  /** Month the progress is computed for (YYYY-MM). */
  month: string;
  baseCurrency: string;
  /** Foreign-currency rows without a rate, excluded from the spent totals. */
  unconvertedCount: number;
  /** All spending in the month (uncategorized included) vs the overall budget. */
  overall: BudgetLimit & { spent: number; recurringSpent: number };
  /** One row per user category, budgeted or not. */
  categories: BudgetCategoryStatus[];
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgets: Repository<Budget>,
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
  ) {}

  findAll(userId: string): Promise<Budget[]> {
    return this.budgets.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Create or replace the budget for a category (or the overall budget when
   * categoryId is null/omitted). With a month, targets that month's override
   * row instead of the standing budget. Upserting keeps at most one row per
   * target — the unique index can't enforce that for NULL columns.
   */
  async upsert(userId: string, dto: UpsertBudgetDto): Promise<Budget> {
    const categoryId = dto.categoryId ?? null;
    const month = dto.month ?? null;
    if (categoryId) {
      // Also asserts ownership (404 for someone else's category).
      await this.categories.findOne(userId, categoryId);
    }
    const existing = await this.budgets.findOne({
      where: {
        userId,
        categoryId: categoryId ?? IsNull(),
        month: month ?? IsNull(),
      },
    });
    if (existing) {
      existing.amount = dto.amount;
      return this.budgets.save(existing);
    }
    return this.budgets.save(
      this.budgets.create({ userId, categoryId, month, amount: dto.amount }),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const budget = await this.budgets.findOne({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    await this.budgets.remove(budget);
  }

  /**
   * Limit lookup for one month over all budget rows: the month's override
   * wins over the standing amount when both exist.
   */
  private limitResolver(
    budgets: Budget[],
    month: string,
  ): (categoryId: string | null) => BudgetLimit {
    const standing = new Map(
      budgets.filter((b) => !b.month).map((b) => [b.categoryId, b]),
    );
    const overrides = new Map(
      budgets.filter((b) => b.month === month).map((b) => [b.categoryId, b]),
    );
    return (categoryId) => {
      const budget = standing.get(categoryId);
      const override = overrides.get(categoryId);
      return {
        budgetId: budget?.id ?? null,
        amount: budget?.amount ?? null,
        overrideId: override?.id ?? null,
        overrideAmount: override?.amount ?? null,
        effectiveAmount: override?.amount ?? budget?.amount ?? null,
      };
    };
  }

  /**
   * Effective total limit for each month of a year (12 entries): the overall
   * budget when one applies, otherwise the sum of the categories' effective
   * limits; null for months where no budget applies at all.
   */
  async monthlyLimits(
    userId: string,
    year: number,
  ): Promise<{ month: string; limit: number | null }[]> {
    const budgets = await this.findAll(userId);
    const categoryIds = [
      ...new Set(
        budgets
          .map((b) => b.categoryId)
          .filter((id): id is string => id !== null),
      ),
    ];
    return Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      const limitFor = this.limitResolver(budgets, month);
      const overall = limitFor(null).effectiveAmount;
      if (overall !== null) return { month, limit: overall };
      const limits = categoryIds
        .map((id) => limitFor(id).effectiveAmount)
        .filter((v): v is number => v !== null);
      return {
        month,
        limit: limits.length ? limits.reduce((a, b) => a + b, 0) : null,
      };
    });
  }

  /** Budget vs actual spend for a month (defaults to the current month). */
  async status(
    userId: string,
    dto: BudgetStatusQueryDto,
  ): Promise<BudgetStatus> {
    const month = dto.month ?? currentMonth();
    const { from, to } = monthRange(month);
    const base = (await this.users.findById(userId)).currency || 'GTQ';

    const spendQuery = () =>
      this.expenses
        .createQueryBuilder('e')
        .leftJoin('e.concept', 'concept')
        .where('e.user_id = :userId', { userId })
        .andWhere("e.kind = 'expense'")
        .andWhere('e.excluded = false')
        .andWhere('e.fecha >= :from AND e.fecha < :to', { from, to });

    const [spentRows, unconvertedCount, budgets, categories] =
      await Promise.all([
        spendQuery()
          .select('concept.category_id', 'categoryId')
          .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'spent')
          .addSelect(
            `COALESCE(SUM(${CONVERTED}) FILTER (WHERE e.recurring_expense_id IS NOT NULL), 0)`,
            'recurringSpent',
          )
          .setParameter('base', base)
          .groupBy('concept.category_id')
          .getRawMany<{
            categoryId: string | null;
            spent: string;
            recurringSpent: string;
          }>(),
        spendQuery()
          .andWhere('e.exchange_rate IS NULL')
          .andWhere('e.currency != :base', { base })
          .getCount(),
        this.findAll(userId),
        this.categories.findAll(userId),
      ]);

    const spentByCategory = new Map(
      spentRows.map((r) => [
        r.categoryId,
        {
          spent: parseFloat(r.spent) || 0,
          recurring: parseFloat(r.recurringSpent) || 0,
        },
      ]),
    );
    const limitFor = this.limitResolver(budgets, month);

    const totals = [...spentByCategory.values()];
    const totalSpent = totals.reduce((a, b) => a + b.spent, 0);
    const totalRecurring = totals.reduce((a, b) => a + b.recurring, 0);

    return {
      month,
      baseCurrency: base,
      unconvertedCount,
      overall: {
        ...limitFor(null),
        spent: totalSpent,
        recurringSpent: totalRecurring,
      },
      categories: categories.map((c) => ({
        categoryId: c.id,
        categoryName: c.name,
        color: c.color,
        ...limitFor(c.id),
        spent: spentByCategory.get(c.id)?.spent ?? 0,
        recurringSpent: spentByCategory.get(c.id)?.recurring ?? 0,
      })),
    };
  }
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** First day of the month and (exclusive) first day of the next month. */
function monthRange(month: string): { from: string; to: string } {
  const [year, mo] = month.split('-').map(Number);
  if (!year || !mo) throw new BadRequestException('Invalid month');
  const next =
    mo === 12 ? `${year + 1}-01` : `${year}-${String(mo + 1).padStart(2, '0')}`;
  return { from: `${month}-01`, to: `${next}-01` };
}
