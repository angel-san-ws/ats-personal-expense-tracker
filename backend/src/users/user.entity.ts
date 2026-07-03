import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { Concept } from '../concepts/concept.entity';
import { Expense } from '../expenses/expense.entity';
import { ImportBatch } from '../import/import-batch.entity';

export type AppLanguage = 'en' | 'es';
export type AppTheme = 'light' | 'dark';

/** Filter-bar state saved as the user's default for a page (keyed by page). */
export interface SavedFilter {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  card?: string;
  currency?: string;
  category?: string;
  concept?: string;
  search?: string;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  language: AppLanguage;

  @Column({ type: 'varchar', length: 8, default: 'GTQ' })
  currency: string;

  @Column({ type: 'varchar', length: 8, default: 'light' })
  theme: AppTheme;

  @Column({ name: 'saved_filters', type: 'jsonb', default: () => "'{}'" })
  savedFilters: Record<string, SavedFilter>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Category, (category) => category.user)
  categories: Category[];

  @OneToMany(() => Concept, (concept) => concept.user)
  concepts: Concept[];

  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Expense[];

  @OneToMany(() => ImportBatch, (batch) => batch.user)
  importBatches: ImportBatch[];
}
