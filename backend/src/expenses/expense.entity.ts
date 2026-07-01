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
import { Concept } from '../concepts/concept.entity';
import { ImportBatch } from '../import/import-batch.entity';
import { decimalTransformer } from '../common/decimal.transformer';

export type ExpenseKind = 'expense' | 'payment';

@Entity('expenses')
@Index(['user', 'fecha'])
@Index(['user', 'tarjeta'])
@Index(['user', 'kind'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Transaction date (FECHA) */
  @Column({ type: 'date' })
  fecha: string;

  /** Card type / holder role (TARJETA), e.g. TITULAR */
  @Column({ type: 'varchar', nullable: true })
  tarjeta: string | null;

  /** Card number last digits (NO TARJETA) */
  @Column({ name: 'no_tarjeta', type: 'varchar', nullable: true })
  noTarjeta: string | null;

  /** Cardholder first name (NOMBRE) */
  @Column({ type: 'varchar', nullable: true })
  nombre: string | null;

  /** Movement type (TIPO DE MOVIMIENTO), e.g. DEBITO / CREDITO */
  @Column({ name: 'tipo_movimiento', type: 'varchar', nullable: true })
  tipoMovimiento: string | null;

  /** Document number (NO. DOC) */
  @Column({ name: 'no_doc', type: 'varchar', nullable: true })
  noDoc: string | null;

  /** Merchant / expense concept text (COMERCIO) */
  @Column()
  comercio: string;

  /**
   * Whether this line is a spending transaction ('expense') or a payment /
   * credit that reduces the balance ('payment'). Payments are excluded from
   * expense views and dashboard spend totals.
   */
  @Column({ type: 'varchar', length: 16, default: 'expense' })
  kind: ExpenseKind;

  /** When true, this expense is excluded from dashboard totals/charts. */
  @Column({ type: 'boolean', default: false })
  excluded: boolean;

  /** ISO currency code of the amount (detected on import, e.g. GTQ, USD). */
  @Column({ type: 'varchar', length: 8, default: 'GTQ' })
  currency: string;

  /** Amount (VALOR) */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  valor: number;

  /** Running balance (SALDO) */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  saldo: number | null;

  @ManyToOne(() => Concept, (concept) => concept.expenses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'concept_id' })
  concept: Concept | null;

  @Column({ name: 'concept_id', type: 'uuid', nullable: true })
  conceptId: string | null;

  @ManyToOne(() => ImportBatch, (batch) => batch.expenses, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch: ImportBatch | null;

  @Column({ name: 'import_batch_id', type: 'uuid', nullable: true })
  importBatchId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
