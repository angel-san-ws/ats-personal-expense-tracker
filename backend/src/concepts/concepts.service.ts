import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { Concept } from './concept.entity';
import { Category } from '../categories/category.entity';
import { MerchantCategoryStat } from './merchant-category-stat.entity';
import { AssignCategoryDto } from './dto';
import { merchantKey, suggestCategoryName } from '../common/category-suggester';
import { categoryNameCandidates } from '../common/default-categories';

export interface ConceptWithStats {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  expenseCount: number;
  totalValor: number;
}

@Injectable()
export class ConceptsService {
  private readonly logger = new Logger(ConceptsService.name);

  constructor(
    @InjectRepository(Concept)
    private readonly concepts: Repository<Concept>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(MerchantCategoryStat)
    private readonly stats: Repository<MerchantCategoryStat>,
  ) {}

  /** List concepts with their category and aggregated expense stats. */
  async findAll(userId: string): Promise<ConceptWithStats[]> {
    const rows = await this.concepts
      .createQueryBuilder('concept')
      .leftJoin('concept.category', 'category')
      .leftJoin('concept.expenses', 'expense')
      .select('concept.id', 'id')
      .addSelect('concept.name', 'name')
      .addSelect('concept.category_id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('category.color', 'categoryColor')
      .addSelect('COUNT(expense.id)', 'expenseCount')
      .addSelect('COALESCE(SUM(expense.valor), 0)', 'totalValor')
      .where('concept.user_id = :userId', { userId })
      .groupBy('concept.id')
      .addGroupBy('category.id')
      .orderBy('concept.name', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName ?? null,
      categoryColor: r.categoryColor ?? null,
      expenseCount: parseInt(r.expenseCount, 10) || 0,
      totalValor: parseFloat(r.totalValor) || 0,
    }));
  }

  async assignCategory(
    userId: string,
    id: string,
    dto: AssignCategoryDto,
  ): Promise<Concept> {
    const concept = await this.concepts.findOne({ where: { id, userId } });
    if (!concept) throw new NotFoundException('Concept not found');
    const previousCategoryId = concept.categoryId;
    concept.categoryId = dto.categoryId ?? null;
    const saved = await this.concepts.save(concept);
    await this.learnAssignment(
      userId,
      concept.name,
      previousCategoryId,
      concept.categoryId,
    );
    return saved;
  }

  /**
   * Record a manual assignment in the shared merchant → category knowledge
   * base so future auto-suggestions (for every account) benefit from it.
   * A re-assignment also revokes the vote given to the previous category, so
   * user corrections gradually outweigh earlier mistakes. Learning failures
   * are logged but never break the assignment itself.
   */
  private async learnAssignment(
    userId: string,
    merchantName: string,
    fromCategoryId: string | null,
    toCategoryId: string | null,
  ): Promise<void> {
    if (fromCategoryId === toCategoryId) return;
    const key = merchantKey(merchantName);
    if (!key) return;

    try {
      const ids = [fromCategoryId, toCategoryId].filter(
        (v): v is string => !!v,
      );
      const cats = await this.categories.find({
        where: { userId, id: In(ids) },
      });
      const nameOf = (catId: string | null) =>
        cats.find((c) => c.id === catId)?.name.trim().toLowerCase() ?? null;

      const fromName = nameOf(fromCategoryId);
      const toName = nameOf(toCategoryId);
      if (fromName) await this.bumpStat(key, fromName, -1);
      if (toName) await this.bumpStat(key, toName, +1);
    } catch (err) {
      this.logger.warn(
        `Could not record category learning for "${merchantName}": ${(err as Error).message}`,
      );
    }
  }

  private async bumpStat(
    key: string,
    categoryName: string,
    delta: 1 | -1,
  ): Promise<void> {
    const existing = await this.stats.findOne({
      where: { merchantKey: key, categoryName },
    });
    if (existing) {
      existing.assignCount = Math.max(0, existing.assignCount + delta);
      await this.stats.save(existing);
    } else if (delta > 0) {
      await this.stats.save(
        this.stats.create({ merchantKey: key, categoryName, assignCount: 1 }),
      );
    }
  }

  /**
   * Suggest a category for a single merchant name without persisting
   * anything (used by the record dialogs). Learned knowledge first,
   * keyword rules as fallback — same precedence as autoCategorize.
   */
  async suggestForName(
    userId: string,
    name: string,
  ): Promise<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
  } | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const categories = await this.categories.find({ where: { userId } });
    const byName = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c]),
    );
    const learned = await this.learnedCategoryByKey([merchantKey(trimmed)]);
    const suggestions = [
      learned.get(merchantKey(trimmed)),
      suggestCategoryName(trimmed),
    ];
    for (const suggestion of suggestions) {
      const category = suggestion
        ? categoryNameCandidates(suggestion)
            .map((name) => byName.get(name))
            .find((c) => c !== undefined)
        : undefined;
      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          categoryColor: category.color,
        };
      }
    }
    return null;
  }

  /**
   * Suggest and assign a category to uncategorized concepts. For each
   * merchant, learned knowledge (how users of this installation categorized
   * the same merchant, see MerchantCategoryStat) takes precedence; keyword
   * rules are the fallback. Suggestions map onto the user's own category
   * catalog by name; concepts the user already categorized are never touched.
   *
   * `conceptIds` limits the run to specific concepts (used by the import
   * pipeline); omit it to process every uncategorized concept.
   * `manager` runs the queries inside an ongoing transaction.
   */
  async autoCategorize(
    userId: string,
    options: { manager?: EntityManager; conceptIds?: string[] } = {},
  ): Promise<{ assigned: number; remaining: number }> {
    if (options.conceptIds && options.conceptIds.length === 0) {
      return { assigned: 0, remaining: 0 };
    }

    const conceptRepo = options.manager
      ? options.manager.getRepository(Concept)
      : this.concepts;
    const categoryRepo = options.manager
      ? options.manager.getRepository(Category)
      : this.categories;

    const categories = await categoryRepo.find({ where: { userId } });
    const categoryIdByName = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );

    const uncategorized = await conceptRepo.find({
      where: {
        userId,
        categoryId: IsNull(),
        ...(options.conceptIds ? { id: In(options.conceptIds) } : {}),
      },
    });

    const learned = await this.learnedCategoryByKey(
      uncategorized.map((c) => merchantKey(c.name)),
      options.manager,
    );

    const updated: Concept[] = [];
    for (const concept of uncategorized) {
      const suggestions = [
        learned.get(merchantKey(concept.name)),
        suggestCategoryName(concept.name),
      ];
      for (const suggestion of suggestions) {
        const categoryId = suggestion
          ? categoryNameCandidates(suggestion)
              .map((name) => categoryIdByName.get(name))
              .find((id) => id !== undefined)
          : undefined;
        if (categoryId) {
          concept.categoryId = categoryId;
          updated.push(concept);
          break;
        }
      }
    }
    if (updated.length > 0) {
      await conceptRepo.save(updated, { chunk: 200 });
    }
    return {
      assigned: updated.length,
      remaining: uncategorized.length - updated.length,
    };
  }

  /**
   * For each merchant key, the category name users assigned it to most often
   * (ties broken by most recently confirmed). Keys without votes are absent.
   */
  private async learnedCategoryByKey(
    keys: string[],
    manager?: EntityManager,
  ): Promise<Map<string, string>> {
    const unique = Array.from(new Set(keys.filter(Boolean)));
    if (unique.length === 0) return new Map();

    const statsRepo = manager
      ? manager.getRepository(MerchantCategoryStat)
      : this.stats;
    const rows = await statsRepo.find({
      where: { merchantKey: In(unique) },
      order: { assignCount: 'DESC', updatedAt: 'DESC' },
    });

    const best = new Map<string, string>();
    for (const row of rows) {
      if (row.assignCount > 0 && !best.has(row.merchantKey)) {
        best.set(row.merchantKey, row.categoryName);
      }
    }
    return best;
  }

  /**
   * Ensures a Concept row exists for every provided name (per user).
   * Returns a map of name -> concept id plus the names that were created.
   * Used by the import pipeline.
   */
  async getOrCreateMany(
    manager: EntityManager,
    userId: string,
    names: string[],
  ): Promise<{ idByName: Map<string, string>; createdNames: string[] }> {
    const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
    const repo = manager.getRepository(Concept);
    const idByName = new Map<string, string>();
    if (unique.length === 0) return { idByName, createdNames: [] };

    const existing = await repo.find({
      where: { userId, name: In(unique) },
    });
    for (const c of existing) idByName.set(c.name, c.id);

    const missing = unique.filter((n) => !idByName.has(n));
    if (missing.length > 0) {
      const created = repo.create(missing.map((name) => ({ userId, name })));
      const saved = await repo.save(created);
      for (const c of saved) idByName.set(c.name, c.id);
    }
    return { idByName, createdNames: missing };
  }
}
