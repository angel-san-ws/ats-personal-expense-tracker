import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { decimalTransformer } from '../common/decimal.transformer';

/**
 * A standing monthly spending limit in the user's base currency. One row per
 * category, plus at most one row with a NULL category — the overall budget
 * across all spending. The same amount applies to every month; per-month
 * progress is computed on the fly from expenses.
 */
@Entity('budgets')
@Index(['user', 'category'], { unique: true })
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** NULL = the overall (all categories) budget. */
  @ManyToOne(() => Category, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  /** Monthly limit, always in the user's base currency. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
