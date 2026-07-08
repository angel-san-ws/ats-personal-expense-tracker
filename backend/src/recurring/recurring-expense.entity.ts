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
import { Account } from '../accounts/account.entity';
import { decimalTransformer } from '../common/decimal.transformer';

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/**
 * Template for a fixed/recurring expense (rent, subscriptions, insurance).
 * Real Expense rows are generated from it on schedule, so all existing
 * filters, aggregations and exports work on the generated instances.
 */
@Entity('recurring_expenses')
@Index(['user', 'active', 'nextRunDate'])
export class RecurringExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Merchant / description used for the generated expenses (COMERCIO). */
  @Column()
  comercio: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  valor: number;

  @Column({ type: 'varchar', length: 8, default: 'GTQ' })
  currency: string;

  @Column({ type: 'varchar', length: 16 })
  frequency: RecurrenceFrequency;

  /**
   * First occurrence date; also the anchor for the recurrence math
   * (monthly = same day-of-month, clamped to shorter months).
   */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** Last date an occurrence may fall on (inclusive); null = open-ended. */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** Next occurrence still to be generated. */
  @Column({ name: 'next_run_date', type: 'date' })
  nextRunDate: string;

  /** Paused templates are skipped by generation. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Optional payment source copied onto generated expenses. */
  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'account_id' })
  account: Account | null;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  /** Legacy free-text card label; superseded by `account`. */
  @Column({ type: 'varchar', nullable: true })
  tarjeta: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
