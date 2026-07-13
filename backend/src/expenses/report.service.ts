import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './expense.entity';
import { CONVERTED } from './expenses.service';
import { BudgetsService } from '../budgets/budgets.service';
import { UsersService } from '../users/users.service';
import { ReportQueryDto } from './dto';

export interface YearReportMonth {
  /** YYYY-MM */
  month: string;
  /** Spend for the month, converted to the base currency. */
  total: number;
  count: number;
  /** Converted spend for the same calendar month of the previous year. */
  prevTotal: number;
  /** Effective budget limit for the month; null when no budget applies. */
  budget: number | null;
}

export interface YearReportCategory {
  categoryId: string | null;
  categoryName: string;
  color: string;
  /** Converted total per month; index 0 = January. */
  monthlyTotals: number[];
  total: number;
}

export interface YearReport {
  year: number;
  /** User's base currency — every converted figure below is in it. */
  baseCurrency: string;
  /** Always 12 entries, January through December. */
  months: YearReportMonth[];
  /** Ordered by year total, descending. */
  byCategory: YearReportCategory[];
  yearTotal: number;
  prevYearTotal: number;
  /** Year total averaged over the months that have any spend. */
  monthlyAverage: number;
  /** Foreign-currency rows without a rate, excluded from converted totals. */
  unconvertedCount: number;
}

const MONTH_BUCKET = "to_char(date_trunc('month', e.fecha), 'YYYY-MM')";

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly users: UsersService,
    private readonly budgets: BudgetsService,
  ) {}

  /** Yearly trends: monthly totals, per-category series, budget vs. actual. */
  async yearReport(userId: string, dto: ReportQueryDto): Promise<YearReport> {
    const year = dto.year ?? new Date().getFullYear();
    const base = (await this.users.findById(userId)).currency || 'GTQ';

    // Spending rows of one calendar year (half-open window).
    const spendQuery = (y: number) =>
      this.expenses
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId })
        .andWhere("e.kind = 'expense'")
        .andWhere('e.excluded = false')
        .andWhere('e.fecha >= :from AND e.fecha < :to', {
          from: `${y}-01-01`,
          to: `${y + 1}-01-01`,
        });

    const monthTotals = (y: number) =>
      spendQuery(y)
        .select(MONTH_BUCKET, 'month')
        .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
        .addSelect('COUNT(e.id)', 'count')
        .setParameter('base', base)
        .groupBy(MONTH_BUCKET)
        .getRawMany<{ month: string; total: string; count: string }>();

    const [yearRows, prevRows, categoryRows, unconvertedCount, limits] =
      await Promise.all([
        monthTotals(year),
        monthTotals(year - 1),
        spendQuery(year)
          .leftJoin('e.concept', 'concept')
          .leftJoin('concept.category', 'category')
          .select('concept.category_id', 'categoryId')
          .addSelect('category.name', 'categoryName')
          .addSelect('category.color', 'color')
          .addSelect(MONTH_BUCKET, 'month')
          .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
          .setParameter('base', base)
          .groupBy('concept.category_id')
          .addGroupBy('category.name')
          .addGroupBy('category.color')
          .addGroupBy(MONTH_BUCKET)
          .getRawMany<{
            categoryId: string | null;
            categoryName: string | null;
            color: string | null;
            month: string;
            total: string;
          }>(),
        spendQuery(year)
          .andWhere('e.exchange_rate IS NULL')
          .andWhere('e.currency != :base', { base })
          .getCount(),
        this.budgets.monthlyLimits(userId, year),
      ]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const byMonth = new Map(yearRows.map((r) => [r.month, r]));
    const prevByMonth = new Map(
      prevRows.map((r) => [r.month, parseFloat(r.total) || 0]),
    );
    const budgetByMonth = new Map(limits.map((l) => [l.month, l.limit]));

    const months: YearReportMonth[] = Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${pad(i + 1)}`;
      const row = byMonth.get(month);
      return {
        month,
        total: row ? parseFloat(row.total) || 0 : 0,
        count: row ? parseInt(row.count, 10) || 0 : 0,
        prevTotal: prevByMonth.get(`${year - 1}-${pad(i + 1)}`) ?? 0,
        budget: budgetByMonth.get(month) ?? null,
      };
    });

    // Pivot category × month rows into one 12-slot series per category.
    const categories = new Map<string | null, YearReportCategory>();
    for (const r of categoryRows) {
      const key = r.categoryId ?? null;
      let cat = categories.get(key);
      if (!cat) {
        cat = {
          categoryId: key,
          categoryName: r.categoryName ?? 'Uncategorized',
          color: r.color ?? '#9ca3af',
          monthlyTotals: Array<number>(12).fill(0),
          total: 0,
        };
        categories.set(key, cat);
      }
      const total = parseFloat(r.total) || 0;
      cat.monthlyTotals[parseInt(r.month.slice(5), 10) - 1] = total;
      cat.total += total;
    }

    const yearTotal = months.reduce((sum, m) => sum + m.total, 0);
    const prevYearTotal = months.reduce((sum, m) => sum + m.prevTotal, 0);
    const monthsWithSpend = months.filter((m) => m.count > 0).length;

    return {
      year,
      baseCurrency: base,
      months,
      byCategory: [...categories.values()].sort((a, z) => z.total - a.total),
      yearTotal,
      prevYearTotal,
      monthlyAverage: monthsWithSpend > 0 ? yearTotal / monthsWithSpend : 0,
      unconvertedCount,
    };
  }
}
