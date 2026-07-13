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

export type NotificationType = 'payment_due' | 'budget_overspend';

/**
 * One email the notifications cron already sent, keyed by what it was about
 * (see `notifications.util.ts` for the dedupe-key formats). The cron checks
 * this table before sending so the same fact is never emailed twice.
 */
@Entity('sent_notifications')
@Index(['userId', 'type', 'dedupeKey'], { unique: true })
export class SentNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  /** What the email was about, e.g. `accountId:dueDate:slot` or `categoryId:month`. */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 128 })
  dedupeKey: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
