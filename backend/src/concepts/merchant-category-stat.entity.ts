import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Crowd-learned merchant → category knowledge, shared across every account
 * in this installation. Each row counts how many times users manually
 * assigned a merchant (normalized to `merchantKey`) to a category (stored by
 * lowercased *name*, since category ids are per-user).
 *
 * Rows are written only on manual assignments — never by the auto-suggester
 * itself — so the data reflects real user decisions and cannot self-reinforce.
 */
@Entity('merchant_category_stats')
@Index(['merchantKey', 'categoryName'], { unique: true })
export class MerchantCategoryStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'merchant_key' })
  merchantKey: string;

  @Column({ name: 'category_name' })
  categoryName: string;

  @Column({ name: 'assign_count', type: 'int', default: 0 })
  assignCount: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
