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

export interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  color: string;
  budgetId: string | null;
  /** Monthly limit in the base currency; null when no budget is set. */
  amount: number | null;
  /** Spend for the month, converted to the base currency. */
  spent: number;
}

export interface BudgetStatus {
  /** Month the progress is computed for (YYYY-MM). */
  month: string;
  baseCurrency: string;
  /** Foreign-currency rows without a rate, excluded from the spent totals. */
  unconvertedCount: number;
  /** All spending in the month (uncategorized included) vs the overall budget. */
  overall: { budgetId: string | null; amount: number | null; spent: number };
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
   * categoryId is null/omitted). Upserting keeps at most one row per target —
   * the unique index can't enforce that for the NULL (overall) row.
   */
  async upsert(userId: string, dto: UpsertBudgetDto): Promise<Budget> {
    const categoryId = dto.categoryId ?? null;
    if (categoryId) {
      // Also asserts ownership (404 for someone else's category).
      await this.categories.findOne(userId, categoryId);
    }
    const existing = await this.budgets.findOne({
      where: { userId, categoryId: categoryId ?? IsNull() },
    });
    if (existing) {
      existing.amount = dto.amount;
      return this.budgets.save(existing);
    }
    return this.budgets.save(
      this.budgets.create({ userId, categoryId, amount: dto.amount }),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const budget = await this.budgets.findOne({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    await this.budgets.remove(budget);
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
          .setParameter('base', base)
          .groupBy('concept.category_id')
          .getRawMany<{ categoryId: string | null; spent: string }>(),
        spendQuery()
          .andWhere('e.exchange_rate IS NULL')
          .andWhere('e.currency != :base', { base })
          .getCount(),
        this.findAll(userId),
        this.categories.findAll(userId),
      ]);

    const spentByCategory = new Map(
      spentRows.map((r) => [r.categoryId, parseFloat(r.spent) || 0]),
    );
    const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

    const overallBudget = budgetByCategory.get(null);
    const totalSpent = [...spentByCategory.values()].reduce((a, b) => a + b, 0);

    return {
      month,
      baseCurrency: base,
      unconvertedCount,
      overall: {
        budgetId: overallBudget?.id ?? null,
        amount: overallBudget?.amount ?? null,
        spent: totalSpent,
      },
      categories: categories.map((c) => {
        const budget = budgetByCategory.get(c.id);
        return {
          categoryId: c.id,
          categoryName: c.name,
          color: c.color,
          budgetId: budget?.id ?? null,
          amount: budget?.amount ?? null,
          spent: spentByCategory.get(c.id) ?? 0,
        };
      }),
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
