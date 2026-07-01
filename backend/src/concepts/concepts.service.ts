import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Concept } from './concept.entity';
import { AssignCategoryDto } from './dto';

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
  constructor(
    @InjectRepository(Concept)
    private readonly concepts: Repository<Concept>,
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
    concept.categoryId = dto.categoryId ?? null;
    return this.concepts.save(concept);
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
