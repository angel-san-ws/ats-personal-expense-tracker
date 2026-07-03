import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../common/decimal.transformer';

/**
 * Cached daily exchange rate, shared across all users (not user-scoped).
 * A row means: on `date`, 1 unit of `base` = `rate` units of `quote`.
 * Only provider-published dates are stored; weekend/holiday gaps are
 * forward-filled at read time.
 */
@Entity('exchange_rates')
@Index(['date', 'base', 'quote'], { unique: true })
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 8 })
  base: string;

  @Column({ type: 'varchar', length: 8 })
  quote: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 8,
    transformer: decimalTransformer,
  })
  rate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
