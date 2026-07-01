import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Expense } from '../expenses/expense.entity';
import { decimalTransformer } from '../common/decimal.transformer';

@Entity('import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.importBatches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  filename: string;

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount: number;

  // --- Statement header metadata (parsed from the top block of the sheet) ---
  @Column({ name: 'cardholder_name', type: 'varchar', nullable: true })
  cardholderName: string | null;

  @Column({ name: 'card_number', type: 'varchar', nullable: true })
  cardNumber: string | null;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  creditLimit: number | null;

  @Column({
    name: 'available_limit',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  availableLimit: number | null;

  @Column({
    name: 'past_due_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  pastDueBalance: number | null;

  @Column({
    name: 'minimum_payment',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  minimumPayment: number | null;

  @Column({ name: 'statement_date', type: 'date', nullable: true })
  statementDate: string | null;

  @Column({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate: string | null;

  // (date columns above already have explicit types)

  @OneToMany(() => Expense, (expense) => expense.importBatch)
  expenses: Expense[];

  @CreateDateColumn({ name: 'imported_at' })
  importedAt: Date;
}
