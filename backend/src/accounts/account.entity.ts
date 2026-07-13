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
import { decimalTransformer } from '../common/decimal.transformer';

export const ACCOUNT_TYPES = [
  'credit_card',
  'debit_card',
  'checking',
  'savings',
  'cash',
  'other',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Normalized identity of a statement row's payment source: the card's last
 * digits when present, else the card label (e.g. TCREDITO8). Imports and the
 * backfill attach expenses to accounts by this key, mirroring the
 * COALESCE(no_tarjeta, tarjeta) grouping the app used before accounts existed.
 */
export function accountMatchKey(
  noTarjeta: string | null | undefined,
  tarjeta: string | null | undefined,
): string | null {
  const raw = (noTarjeta ?? '').trim() || (tarjeta ?? '').trim();
  return raw ? raw.toUpperCase() : null;
}

/**
 * A payment source (credit card, bank account, cash…) that expenses belong
 * to. Auto-created during import from the statement's card columns and
 * matched via `matchKey`; everything else (name, type, color…) is
 * user-editable metadata, so renaming an account never touches expense rows.
 */
@Entity('accounts')
@Index(['user', 'matchKey'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Display name, e.g. "BAM Visa Gold". Defaults to the raw card value. */
  @Column()
  name: string;

  @Column({ type: 'varchar', length: 16, default: 'credit_card' })
  type: AccountType;

  /** See {@link accountMatchKey}. Unique per user. */
  @Column({ name: 'match_key', type: 'varchar' })
  matchKey: string;

  /** Card number last digits, when known. */
  @Column({ name: 'last_four', type: 'varchar', length: 8, nullable: true })
  lastFour: string | null;

  /** Bank / issuer name (cosmetic). */
  @Column({ type: 'varchar', nullable: true })
  institution: string | null;

  /** Hex color for charts and chips. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  /** Archived accounts are hidden from pickers but keep their history. */
  @Column({ type: 'boolean', default: false })
  archived: boolean;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  creditLimit: number | null;

  /**
   * Day of the month (1–31, clamped to shorter months) the card's payment is
   * due. Set by the user to get a monthly due-date reminder even without
   * importing statements; a statement-derived due date takes precedence.
   */
  @Column({ name: 'payment_due_day', type: 'int', nullable: true })
  paymentDueDay: number | null;

  /** Expected/typical payment amount shown on manual reminders. */
  @Column({
    name: 'payment_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  paymentAmount: number | null;

  /**
   * Payment reminders with a due date on or before this date are dismissed
   * (hidden). Set to the reminder's due date when the user dismisses it, so
   * the next cycle's reminder shows again.
   */
  @Column({ name: 'reminder_dismissed_through', type: 'date', nullable: true })
  reminderDismissedThrough: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
