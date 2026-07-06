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

  /** NULL for accounts created via Google sign-in (no password set). */
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  /**
   * When the user proved ownership of their email. Stamped immediately for
   * Google sign-ins (Google already verified it); NULL until the verification
   * link is clicked for password registrations. Verification is soft — it
   * never blocks login, it only drives the "verify your email" banner.
   */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** SHA-256 hex of the pending verification token (raw token only goes in the email). */
  @Column({
    name: 'email_verification_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  emailVerificationTokenHash: string | null;

  @Column({
    name: 'email_verification_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpiresAt: Date | null;

  @Column()
  name: string;

  /** E.164-style number incl. country code (e.g. +50255512345); used for WhatsApp. */
  @Column({ name: 'mobile_phone', type: 'varchar', length: 20, nullable: true })
  mobilePhone: string | null;

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
