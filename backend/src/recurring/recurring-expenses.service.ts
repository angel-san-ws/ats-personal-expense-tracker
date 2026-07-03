import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Expense } from '../expenses/expense.entity';
import { Concept } from '../concepts/concept.entity';
import { Category } from '../categories/category.entity';
import { ConceptsService } from '../concepts/concepts.service';
import { UsersService } from '../users/users.service';
import { RatesService } from '../rates/rates.service';
import {
  RecurrenceFrequency,
  RecurringExpense,
} from './recurring-expense.entity';
import { CreateRecurringExpenseDto, UpdateRecurringExpenseDto } from './dto';
import {
  localTodayIso,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
} from './recurrence.util';

/** Safety cap on instances generated per template per run (~19 years weekly). */
const MAX_INSTANCES_PER_RUN = 1000;

export interface RecurringExpenseRow {
  id: string;
  comercio: string;
  valor: number;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  active: boolean;
  tarjeta: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  generatedCount: number;
  lastGeneratedDate: string | null;
  createdAt: Date;
}

@Injectable()
export class RecurringExpensesService {
  constructor(
    @InjectRepository(RecurringExpense)
    private readonly recurring: Repository<RecurringExpense>,
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly concepts: ConceptsService,
    private readonly users: UsersService,
    private readonly rates: RatesService,
  ) {}

  private validateDates(startDate: string, endDate: string | null): void {
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  /** Assign the merchant's concept to a category (creates the concept early). */
  private async assignCategory(
    userId: string,
    comercio: string,
    categoryId: string,
  ): Promise<void> {
    const { idByName } = await this.concepts.getOrCreateMany(
      this.expenses.manager,
      userId,
      [comercio],
    );
    const conceptId = idByName.get(comercio);
    if (conceptId) {
      await this.concepts.assignCategory(userId, conceptId, { categoryId });
    }
  }

  async create(
    userId: string,
    dto: CreateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    const endDate = dto.endDate || null;
    this.validateDates(dto.startDate, endDate);
    const entity = this.recurring.create({
      userId,
      comercio: dto.comercio.trim(),
      valor: dto.valor,
      currency: dto.currency?.trim().toUpperCase() || undefined,
      frequency: dto.frequency as RecurrenceFrequency,
      startDate: dto.startDate,
      endDate,
      nextRunDate: dto.startDate,
      active: dto.active ?? true,
      tarjeta: dto.tarjeta?.trim() || null,
    });
    const saved = await this.recurring.save(entity);
    if (dto.categoryId) {
      await this.assignCategory(userId, saved.comercio, dto.categoryId);
    }
    return saved;
  }

  /**
   * Edit a template. Only future instances are affected: when the schedule
   * (frequency/startDate) changes, nextRunDate moves to the first occurrence
   * of the new schedule from today on — already-generated expenses stay.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    const entity = await this.recurring.findOne({ where: { id, userId } });
    if (!entity) throw new NotFoundException('Recurring expense not found');

    const scheduleChanged =
      (dto.frequency !== undefined && dto.frequency !== entity.frequency) ||
      (dto.startDate !== undefined && dto.startDate !== entity.startDate);

    if (dto.comercio !== undefined) {
      const comercio = dto.comercio.trim();
      if (comercio) entity.comercio = comercio;
    }
    if (dto.valor !== undefined) entity.valor = dto.valor;
    if (dto.currency !== undefined) {
      entity.currency = dto.currency.trim().toUpperCase() || entity.currency;
    }
    if (dto.frequency !== undefined) {
      entity.frequency = dto.frequency as RecurrenceFrequency;
    }
    if (dto.startDate !== undefined) entity.startDate = dto.startDate;
    if (dto.endDate !== undefined) entity.endDate = dto.endDate || null;
    if (dto.tarjeta !== undefined) entity.tarjeta = dto.tarjeta.trim() || null;
    if (dto.active !== undefined) entity.active = dto.active;

    this.validateDates(entity.startDate, entity.endDate);

    if (scheduleChanged) {
      const today = localTodayIso();
      const from = today > entity.startDate ? today : entity.startDate;
      entity.nextRunDate = nextOccurrenceOnOrAfter(
        entity.startDate,
        entity.frequency,
        from,
      );
    }
    const saved = await this.recurring.save(entity);
    if (dto.categoryId) {
      await this.assignCategory(userId, saved.comercio, dto.categoryId);
    }
    return saved;
  }

  /** Delete a template. Generated expenses are kept (FK set to null). */
  async remove(userId: string, id: string): Promise<void> {
    const result = await this.recurring.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException('Recurring expense not found');
    }
  }

  /** All templates with per-template stats over the generated expenses. */
  async findAll(userId: string): Promise<RecurringExpenseRow[]> {
    const rows = await this.recurring
      .createQueryBuilder('r')
      .leftJoin(Expense, 'e', 'e.recurring_expense_id = r.id')
      // (user, name) is unique on concepts, so this join never multiplies rows.
      .leftJoin(Concept, 'c', 'c.user_id = r.user_id AND c.name = r.comercio')
      .leftJoin(Category, 'cat', 'cat.id = c.category_id')
      .select([
        'r.id AS id',
        'r.comercio AS comercio',
        'r.valor AS valor',
        'r.currency AS currency',
        'r.frequency AS frequency',
        'r.start_date AS "startDate"',
        'r.end_date AS "endDate"',
        'r.next_run_date AS "nextRunDate"',
        'r.active AS active',
        'r.tarjeta AS tarjeta',
        'r.created_at AS "createdAt"',
        'c.category_id AS "categoryId"',
        'cat.name AS "categoryName"',
        'cat.color AS "categoryColor"',
      ])
      .addSelect('COUNT(e.id)', 'generatedCount')
      .addSelect('MAX(e.fecha)', 'lastGeneratedDate')
      .where('r.user_id = :userId', { userId })
      .groupBy('r.id')
      .addGroupBy('c.category_id')
      .addGroupBy('cat.name')
      .addGroupBy('cat.color')
      .orderBy('r.created_at', 'DESC')
      .getRawMany();

    const toIso = (v: unknown): string | null => {
      if (!v) return null;
      return v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    };

    return rows.map((r) => ({
      id: r.id,
      comercio: r.comercio,
      valor: parseFloat(r.valor),
      currency: r.currency,
      frequency: r.frequency,
      startDate: toIso(r.startDate) as string,
      endDate: toIso(r.endDate),
      nextRunDate: toIso(r.nextRunDate) as string,
      active: r.active === true || r.active === 'true',
      tarjeta: r.tarjeta,
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName ?? null,
      categoryColor: r.categoryColor ?? null,
      generatedCount: parseInt(r.generatedCount, 10) || 0,
      lastGeneratedDate: toIso(r.lastGeneratedDate),
      createdAt: r.createdAt,
    }));
  }

  /**
   * Catch-up generation: create Expense rows for every occurrence due up to
   * today across all active templates. Idempotent per day — templates whose
   * nextRunDate is in the future are untouched. Called lazily from the app
   * (on load / after saving a template), so no cron process is required.
   */
  async generateDue(userId: string): Promise<{ generated: number }> {
    const today = localTodayIso();
    const due = await this.recurring.find({
      where: { userId, active: true, nextRunDate: LessThanOrEqual(today) },
    });
    if (due.length === 0) return { generated: 0 };

    // Rate to the user's base currency per (currency, occurrence date);
    // memoized across templates. Null (provider unreachable) leaves the row
    // pending conversion — never blocks generation.
    const base = (await this.users.findById(userId)).currency || 'GTQ';
    const rateMemo = new Map<string, number | null>();
    const rateFor = async (currency: string, fecha: string) => {
      if (currency === base) return 1;
      const key = `${currency}|${fecha}`;
      if (!rateMemo.has(key)) {
        rateMemo.set(key, await this.rates.getRate(fecha, currency, base));
      }
      return rateMemo.get(key) ?? null;
    };

    let generated = 0;
    for (const template of due) {
      const { idByName } = await this.concepts.getOrCreateMany(
        this.expenses.manager,
        userId,
        [template.comercio],
      );
      const conceptId = idByName.get(template.comercio) ?? null;

      const rows: Partial<Expense>[] = [];
      let next = template.nextRunDate;
      while (
        next <= today &&
        (!template.endDate || next <= template.endDate) &&
        rows.length < MAX_INSTANCES_PER_RUN
      ) {
        rows.push({
          userId,
          fecha: next,
          comercio: template.comercio,
          valor: template.valor,
          currency: template.currency,
          exchangeRate: await rateFor(template.currency, next),
          kind: 'expense',
          conceptId,
          tarjeta: template.tarjeta,
          recurringExpenseId: template.id,
        });
        next = nextOccurrenceAfter(
          template.startDate,
          template.frequency,
          next,
        );
      }

      if (rows.length) {
        await this.expenses.save(this.expenses.create(rows));
        generated += rows.length;
      }

      template.nextRunDate = next;
      // Past its end date the template has nothing left to generate.
      if (template.endDate && next > template.endDate) {
        template.active = false;
      }
      await this.recurring.save(template);
    }
    return { generated };
  }
}
