import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Expense, ExpenseKind } from './expense.entity';
import { AccountsService } from '../accounts/accounts.service';
import { ConceptsService } from '../concepts/concepts.service';
import { UsersService } from '../users/users.service';
import { RatesService } from '../rates/rates.service';
import {
  RateStampingService,
  StampResult,
} from '../rates/rate-stamping.service';
import {
  BatchUpdateExpensesDto,
  CreateExpenseDto,
  QueryExpensesDto,
  UpdateExpenseDto,
} from './dto';

/**
 * Amount converted to the user's base currency (bind :base). Unstamped
 * base-currency rows count at face value; unstamped foreign rows yield NULL,
 * which SUM ignores — they are excluded from converted totals and surface
 * through `unconvertedCount`.
 */
export const CONVERTED =
  'e.valor * COALESCE(e.exchange_rate, CASE WHEN e.currency = :base THEN 1 END)';

export interface ExpenseRow {
  id: string;
  fecha: string;
  accountId: string | null;
  accountName: string | null;
  accountColor: string | null;
  tarjeta: string | null;
  noTarjeta: string | null;
  nombre: string | null;
  tipoMovimiento: string | null;
  noDoc: string | null;
  comercio: string;
  valor: number;
  saldo: number | null;
  kind: string;
  excluded: boolean;
  currency: string;
  exchangeRate: number | null;
  conceptId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  recurringExpenseId: string | null;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface PagedExpenses {
  items: ExpenseRow[];
  total: number;
  totalsByCurrency: CurrencyTotal[];
  page: number;
  size: number;
}

export interface DashboardSummary {
  /** User's base currency — every converted figure below is in it. */
  baseCurrency: string;
  totalValor: number;
  count: number;
  avgValor: number;
  /** Foreign-currency rows without a rate, excluded from converted totals. */
  unconvertedCount: number;
  byCurrency: CurrencyTotal[];
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    color: string;
    total: number;
    count: number;
  }[];
  byAccount: {
    accountId: string | null;
    name: string;
    color: string | null;
    total: number;
    count: number;
  }[];
  byMonth: { month: string; total: number; count: number }[];
  /** Per-day totals within the range (day is YYYY-MM-DD). */
  byDay: { day: string; total: number; count: number }[];
  /**
   * Totals for the selected window and the 3 preceding windows of the same
   * length, oldest first (last entry = the selected window). Only computed
   * for ranges of at most 31 days; empty otherwise.
   */
  previousPeriods: { from: string; to: string; total: number; count: number }[];
  topMerchants: { comercio: string; total: number; count: number }[];
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly accounts: AccountsService,
    private readonly concepts: ConceptsService,
    private readonly users: UsersService,
    private readonly rates: RatesService,
    private readonly stamping: RateStampingService,
  ) {}

  /** User's base currency; converted amounts are expressed in it. */
  private async baseCurrency(userId: string): Promise<string> {
    return (await this.users.findById(userId)).currency || 'GTQ';
  }

  /** Resolve (or create) the Concept for a merchant name. Payments carry no concept. */
  private async resolveConceptId(
    userId: string,
    kind: ExpenseKind,
    comercio: string,
  ): Promise<string | null> {
    if (kind !== 'expense') return null;
    const { idByName } = await this.concepts.getOrCreateMany(
      this.expenses.manager,
      userId,
      [comercio],
    );
    return idByName.get(comercio) ?? null;
  }

  /** Manually add an expense or payment (kind defaults to 'expense'). */
  async create(userId: string, dto: CreateExpenseDto): Promise<Expense> {
    const kind = (dto.kind ?? 'expense') as ExpenseKind;
    const comercio = dto.comercio.trim();
    const conceptId = await this.resolveConceptId(userId, kind, comercio);
    if (dto.categoryId && conceptId) {
      await this.concepts.assignCategory(userId, conceptId, {
        categoryId: dto.categoryId,
      });
    }
    const currency = dto.currency?.trim().toUpperCase() || 'GTQ';
    const base = await this.baseCurrency(userId);
    if (dto.accountId) {
      await this.accounts.findOwned(userId, dto.accountId);
    }
    const expense = this.expenses.create({
      userId,
      fecha: dto.fecha,
      comercio,
      valor: dto.valor,
      kind,
      conceptId,
      currency,
      // Null when the rate provider is unreachable — never block the save.
      exchangeRate:
        currency === base
          ? 1
          : await this.rates.getRate(dto.fecha, currency, base),
      accountId: dto.accountId ?? null,
      tarjeta: dto.tarjeta?.trim() || null,
      noTarjeta: dto.noTarjeta?.trim() || null,
      tipoMovimiento: dto.tipoMovimiento?.trim() || null,
    });
    return this.expenses.save(expense);
  }

  /** Edit a manually added or imported expense/payment. */
  async update(
    userId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.expenses.findOne({ where: { id, userId } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (dto.fecha !== undefined) expense.fecha = dto.fecha;
    if (dto.valor !== undefined) expense.valor = dto.valor;
    if (dto.currency !== undefined) {
      expense.currency = dto.currency.trim().toUpperCase() || expense.currency;
    }
    if (dto.accountId !== undefined) {
      if (dto.accountId) {
        await this.accounts.findOwned(userId, dto.accountId);
      }
      expense.accountId = dto.accountId || null;
    }
    if (dto.tarjeta !== undefined) expense.tarjeta = dto.tarjeta.trim() || null;
    if (dto.noTarjeta !== undefined) {
      expense.noTarjeta = dto.noTarjeta.trim() || null;
    }
    if (dto.tipoMovimiento !== undefined) {
      expense.tipoMovimiento = dto.tipoMovimiento.trim() || null;
    }
    if (dto.comercio !== undefined) {
      const comercio = dto.comercio.trim();
      if (comercio && comercio !== expense.comercio) {
        expense.comercio = comercio;
        expense.conceptId = await this.resolveConceptId(
          userId,
          expense.kind,
          comercio,
        );
      }
    }
    if (dto.categoryId && expense.conceptId) {
      await this.concepts.assignCategory(userId, expense.conceptId, {
        categoryId: dto.categoryId,
      });
    }
    // Recompute the rate when the date/currency changed; also retry
    // opportunistically for rows still pending conversion.
    if (
      dto.fecha !== undefined ||
      dto.currency !== undefined ||
      expense.exchangeRate === null
    ) {
      const base = await this.baseCurrency(userId);
      expense.exchangeRate =
        expense.currency === base
          ? 1
          : await this.rates.getRate(expense.fecha, expense.currency, base);
    }
    return this.expenses.save(expense);
  }

  /** Backfill/retry rate stamping for all of the user's pending rows. */
  async refreshRates(userId: string): Promise<StampResult> {
    return this.stamping.stampPending(userId, await this.baseCurrency(userId));
  }

  /**
   * Assign a category to the merchants (concepts) of the selected expenses.
   * Categories live on the concept, so every expense of those merchants is
   * affected, not just the selected rows. Payments carry no concept and are
   * skipped. Returns how many distinct concepts were reassigned.
   */
  async batchAssignCategory(
    userId: string,
    ids: string[],
    categoryId: string | null,
  ): Promise<{ concepts: number }> {
    const rows = await this.expenses.find({
      where: { userId, id: In(ids) },
      select: { conceptId: true },
    });
    const conceptIds = [
      ...new Set(
        rows.map((r) => r.conceptId).filter((v): v is string => v !== null),
      ),
    ];
    // One call per concept so each merchant records its own learning vote.
    for (const conceptId of conceptIds) {
      await this.concepts.assignCategory(userId, conceptId, { categoryId });
    }
    return { concepts: conceptIds.length };
  }

  /**
   * Apply the provided fields (card, card number, type, merchant) to the
   * selected expenses. Empty strings clear the column. A merchant change
   * re-points expense rows at that merchant's concept — inheriting its
   * category — exactly like the single-row update; payments keep no concept.
   */
  async batchUpdate(
    userId: string,
    ids: string[],
    dto: BatchUpdateExpensesDto,
  ): Promise<{ updated: number }> {
    const patch: Partial<Expense> = {};
    if (dto.accountId !== undefined) {
      if (dto.accountId) {
        await this.accounts.findOwned(userId, dto.accountId);
      }
      patch.accountId = dto.accountId || null;
    }
    if (dto.tarjeta !== undefined) patch.tarjeta = dto.tarjeta.trim() || null;
    if (dto.noTarjeta !== undefined) {
      patch.noTarjeta = dto.noTarjeta.trim() || null;
    }
    if (dto.tipoMovimiento !== undefined) {
      patch.tipoMovimiento = dto.tipoMovimiento.trim() || null;
    }
    const comercio = dto.comercio?.trim();
    if (!comercio && Object.keys(patch).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    if (!comercio) {
      const res = await this.expenses.update({ userId, id: In(ids) }, patch);
      return { updated: res.affected ?? 0 };
    }
    const { idByName } = await this.concepts.getOrCreateMany(
      this.expenses.manager,
      userId,
      [comercio],
    );
    const exp = await this.expenses.update(
      { userId, id: In(ids), kind: 'expense' },
      { ...patch, comercio, conceptId: idByName.get(comercio) ?? null },
    );
    const pay = await this.expenses.update(
      { userId, id: In(ids), kind: 'payment' },
      { ...patch, comercio },
    );
    return { updated: (exp.affected ?? 0) + (pay.affected ?? 0) };
  }

  /** Delete a set of expenses/payments owned by the user. */
  async batchDelete(
    userId: string,
    ids: string[],
  ): Promise<{ deleted: number }> {
    const result = await this.expenses.delete({ userId, id: In(ids) });
    return { deleted: result.affected ?? 0 };
  }

  /** Base query with all shared filters applied (joins category via concept). */
  private baseQuery(
    userId: string,
    dto: QueryExpensesDto,
    onlyIncluded = false,
  ): SelectQueryBuilder<Expense> {
    const qb = this.expenses
      .createQueryBuilder('e')
      .leftJoin('e.concept', 'concept')
      .leftJoin('concept.category', 'category')
      .leftJoin('e.account', 'account')
      .where('e.user_id = :userId', { userId });

    // Default to spending transactions only; 'payment' or 'all' opt in.
    const kind = dto.kind ?? 'expense';
    if (kind !== 'all') {
      qb.andWhere('e.kind = :kind', { kind });
    }

    // Dashboard aggregates ignore rows the user flagged as excluded.
    if (onlyIncluded) {
      qb.andWhere('e.excluded = false');
    }

    if (dto.dateFrom)
      qb.andWhere('e.fecha >= :dateFrom', { dateFrom: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('e.fecha <= :dateTo', { dateTo: dto.dateTo });

    if (dto.accountId) {
      qb.andWhere('e.account_id = :accountId', { accountId: dto.accountId });
    }

    // Legacy raw-column filter, kept so old links/saved filters still work.
    if (dto.card) {
      qb.andWhere('(e.tarjeta = :card OR e.no_tarjeta = :card)', {
        card: dto.card,
      });
    }

    if (dto.currency) {
      qb.andWhere('e.currency = :currency', { currency: dto.currency });
    }

    if (dto.search) {
      qb.andWhere('e.comercio ILIKE :search', { search: `%${dto.search}%` });
    }

    if (dto.conceptId) {
      qb.andWhere('e.concept_id = :conceptId', { conceptId: dto.conceptId });
    }

    if (dto.categoryId) {
      qb.andWhere('concept.category_id = :categoryId', {
        categoryId: dto.categoryId,
      });
    }

    if (dto.categoryFilter === 'none') {
      qb.andWhere('concept.category_id IS NULL');
    }

    return qb;
  }

  async findAll(userId: string, dto: QueryExpensesDto): Promise<PagedExpenses> {
    // Adopt any pre-account rows so every listed row carries its account.
    await this.accounts.ensureBackfilled(userId);
    const page = dto.page ?? 0;
    const size = dto.size ?? 25;
    const sortField = dto.sortField ?? 'fecha';
    const sortOrder =
      (dto.sortOrder ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sortColumnMap: Record<string, string> = {
      fecha: 'e.fecha',
      valor: 'e.valor',
      comercio: 'e.comercio',
      tarjeta: 'e.tarjeta',
      account: 'account.name',
    };
    const sortColumn = sortColumnMap[sortField] ?? 'e.fecha';

    const qb = this.baseQuery(userId, dto)
      .select([
        'e.id AS id',
        'e.fecha AS fecha',
        'e.account_id AS "accountId"',
        'account.name AS "accountName"',
        'account.color AS "accountColor"',
        'e.tarjeta AS tarjeta',
        'e.no_tarjeta AS "noTarjeta"',
        'e.nombre AS nombre',
        'e.tipo_movimiento AS "tipoMovimiento"',
        'e.no_doc AS "noDoc"',
        'e.comercio AS comercio',
        'e.valor AS valor',
        'e.saldo AS saldo',
        'e.kind AS kind',
        'e.excluded AS excluded',
        'e.currency AS currency',
        'e.exchange_rate AS "exchangeRate"',
        'e.concept_id AS "conceptId"',
        'e.recurring_expense_id AS "recurringExpenseId"',
        'concept.category_id AS "categoryId"',
        'category.name AS "categoryName"',
        'category.color AS "categoryColor"',
      ])
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('e.created_at', 'DESC')
      .offset(page * size)
      .limit(size);

    // Count over the whole filtered set + per-currency amount totals.
    const [rawItems, totalsByCurrency] = await Promise.all([
      qb.getRawMany(),
      this.currencyTotals(userId, dto),
    ]);
    const total = totalsByCurrency.reduce((sum, c) => sum + c.count, 0);

    const items: ExpenseRow[] = rawItems.map((r) => ({
      id: r.id,
      fecha:
        r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
      accountId: r.accountId ?? null,
      accountName: r.accountName ?? null,
      accountColor: r.accountColor ?? null,
      tarjeta: r.tarjeta,
      noTarjeta: r.noTarjeta,
      nombre: r.nombre,
      tipoMovimiento: r.tipoMovimiento,
      noDoc: r.noDoc,
      comercio: r.comercio,
      valor: parseFloat(r.valor),
      saldo: r.saldo === null ? null : parseFloat(r.saldo),
      kind: r.kind,
      excluded: r.excluded === true || r.excluded === 'true',
      currency: r.currency,
      exchangeRate: r.exchangeRate == null ? null : parseFloat(r.exchangeRate),
      conceptId: r.conceptId ?? null,
      recurringExpenseId: r.recurringExpenseId ?? null,
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName ?? null,
      categoryColor: r.categoryColor ?? null,
    }));

    return { items, total, totalsByCurrency, page, size };
  }

  /** Per-currency count and amount total for the filtered set. */
  private async currencyTotals(
    userId: string,
    dto: QueryExpensesDto,
  ): Promise<CurrencyTotal[]> {
    const rows = await this.baseQuery(userId, dto)
      .select('e.currency', 'currency')
      .addSelect('COALESCE(SUM(e.valor), 0)', 'total')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('e.currency')
      .orderBy('total', 'DESC')
      .getRawMany();
    return rows.map((r) => ({
      currency: r.currency,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));
  }

  async summary(
    userId: string,
    dto: QueryExpensesDto,
  ): Promise<DashboardSummary> {
    await this.accounts.ensureBackfilled(userId);
    const base = await this.baseCurrency(userId);

    // Totals, converted to the base currency
    const totalsRaw = await this.baseQuery(userId, dto, true)
      .select(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .getRawOne();

    const totalValor = parseFloat(totalsRaw.total) || 0;
    const count = parseInt(totalsRaw.count, 10) || 0;

    // Foreign-currency rows pending conversion (excluded from totals).
    const unconvertedCount = await this.baseQuery(userId, dto, true)
      .andWhere('e.exchange_rate IS NULL')
      .andWhere('e.currency != :base', { base })
      .getCount();

    // Totals per currency (amounts are never converted).
    const byCurrencyRaw = await this.baseQuery(userId, dto, true)
      .select('e.currency', 'currency')
      .addSelect('COALESCE(SUM(e.valor), 0)', 'total')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('e.currency')
      .orderBy('total', 'DESC')
      .getRawMany();
    const byCurrency = byCurrencyRaw.map((r) => ({
      currency: r.currency,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // By category (including uncategorized)
    const byCategoryRaw = await this.baseQuery(userId, dto, true)
      .select('concept.category_id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('category.color', 'color')
      .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .groupBy('concept.category_id')
      .addGroupBy('category.name')
      .addGroupBy('category.color')
      .orderBy('total', 'DESC')
      .getRawMany();

    const byCategory = byCategoryRaw.map((r) => ({
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName ?? 'Uncategorized',
      color: r.color ?? '#9ca3af',
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // By account (payment source)
    const byAccountRaw = await this.baseQuery(userId, dto, true)
      .select('account.id', 'accountId')
      .addSelect('account.name', 'name')
      .addSelect('account.color', 'color')
      .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .groupBy('account.id')
      .addGroupBy('account.name')
      .addGroupBy('account.color')
      .orderBy('total', 'DESC')
      .getRawMany();

    const byAccount = byAccountRaw.map((r) => ({
      accountId: r.accountId ?? null,
      name: r.name ?? 'N/A',
      color: r.color ?? null,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // By month
    const byMonthRaw = await this.baseQuery(userId, dto, true)
      .select("to_char(date_trunc('month', e.fecha), 'YYYY-MM')", 'month')
      .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .groupBy("date_trunc('month', e.fecha)")
      .orderBy("date_trunc('month', e.fecha)", 'ASC')
      .getRawMany();

    const byMonth = byMonthRaw.map((r) => ({
      month: r.month,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // By day
    const byDayRaw = await this.baseQuery(userId, dto, true)
      .select("to_char(e.fecha, 'YYYY-MM-DD')", 'day')
      .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .groupBy('e.fecha')
      .orderBy('e.fecha', 'ASC')
      .getRawMany();

    const byDay = byDayRaw.map((r) => ({
      day: r.day,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // Selected window vs the 3 preceding windows of the same length
    const previousPeriods: DashboardSummary['previousPeriods'] = [];
    if (dto.dateFrom && dto.dateTo) {
      const from = new Date(`${dto.dateFrom}T00:00:00`);
      const to = new Date(`${dto.dateTo}T00:00:00`);
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days >= 1 && days <= 31) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const iso = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        for (let i = 3; i >= 0; i--) {
          const wFrom = new Date(from);
          wFrom.setDate(wFrom.getDate() - i * days);
          const wTo = new Date(to);
          wTo.setDate(wTo.getDate() - i * days);
          const window = { from: iso(wFrom), to: iso(wTo) };
          const raw = await this.baseQuery(
            userId,
            { ...dto, dateFrom: window.from, dateTo: window.to },
            true,
          )
            .select(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
            .addSelect('COUNT(e.id)', 'count')
            .setParameter('base', base)
            .getRawOne();
          previousPeriods.push({
            ...window,
            total: parseFloat(raw.total) || 0,
            count: parseInt(raw.count, 10) || 0,
          });
        }
      }
    }

    // Top merchants
    const topMerchantsRaw = await this.baseQuery(userId, dto, true)
      .select('e.comercio', 'comercio')
      .addSelect(`COALESCE(SUM(${CONVERTED}), 0)`, 'total')
      .addSelect('COUNT(e.id)', 'count')
      .setParameter('base', base)
      .groupBy('e.comercio')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    const topMerchants = topMerchantsRaw.map((r) => ({
      comercio: r.comercio,
      total: parseFloat(r.total) || 0,
      count: parseInt(r.count, 10) || 0,
    }));

    // Average over rows that actually contribute to the converted total.
    const convertedCount = count - unconvertedCount;

    return {
      baseCurrency: base,
      totalValor,
      count,
      avgValor: convertedCount > 0 ? totalValor / convertedCount : 0,
      unconvertedCount,
      byCurrency,
      byCategory,
      byAccount,
      byMonth,
      byDay,
      previousPeriods,
      topMerchants,
    };
  }

  /** Flag/unflag an expense so it is (not) counted in the dashboard. */
  async setExcluded(
    userId: string,
    id: string,
    excluded: boolean,
  ): Promise<void> {
    const result = await this.expenses.update({ id, userId }, { excluded });
    if (!result.affected) {
      throw new NotFoundException('Expense not found');
    }
  }

  /** Distinct currencies present for this user (for the filter dropdown). */
  async distinctCurrencies(userId: string): Promise<string[]> {
    const rows = await this.expenses
      .createQueryBuilder('e')
      .select('e.currency', 'currency')
      .where('e.user_id = :userId', { userId })
      .groupBy('e.currency')
      .orderBy('e.currency', 'ASC')
      .getRawMany();
    return rows.map((r) => r.currency).filter(Boolean);
  }

  /** Distinct card names, card numbers and movement types, for suggestion dropdowns. */
  async fieldOptions(userId: string): Promise<{
    tarjetas: string[];
    noTarjetas: string[];
    tipoMovimientos: string[];
  }> {
    const distinct = async (
      column: 'tarjeta' | 'no_tarjeta' | 'tipo_movimiento',
    ) => {
      const rows = await this.expenses
        .createQueryBuilder('e')
        .select(`e.${column}`, 'value')
        .where('e.user_id = :userId', { userId })
        .andWhere(`e.${column} IS NOT NULL`)
        .groupBy(`e.${column}`)
        .orderBy('value', 'ASC')
        .getRawMany<{ value: string }>();
      return rows.map((r) => r.value).filter(Boolean);
    };
    return {
      tarjetas: await distinct('tarjeta'),
      noTarjetas: await distinct('no_tarjeta'),
      tipoMovimientos: await distinct('tipo_movimiento'),
    };
  }
}
