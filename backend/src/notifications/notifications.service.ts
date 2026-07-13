import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { NotificationType, SentNotification } from './sent-notification.entity';
import { MailService } from '../mail/mail.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PaymentRemindersService } from '../import/payment-reminders.service';
import {
  overspentTargets,
  paymentDueKey,
  paymentDueSlot,
} from './notifications.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SentNotification)
    private readonly sent: Repository<SentNotification>,
    private readonly reminders: PaymentRemindersService,
    private readonly budgets: BudgetsService,
    private readonly mail: MailService,
  ) {}

  /**
   * Daily at 8:00 AM in Guatemala (America/Guatemala, UTC-6 year-round — the
   * user base is assumed to live there; the explicit timeZone keeps the hour
   * right regardless of where the server runs). Everything downstream is
   * best-effort: a mail failure just leaves the dedupe row unwritten, so the
   * next run retries while the fact still applies.
   */
  @Cron('0 0 8 * * *', { timeZone: 'America/Guatemala' })
  async runDaily(): Promise<void> {
    const users = await this.users.find({
      where: [{ notifyPaymentDue: true }, { notifyBudgetOverspend: true }],
    });
    this.logger.log(`Notification run: ${users.length} opted-in user(s)`);
    for (const user of users) {
      try {
        await this.notifyUser(user);
      } catch (err) {
        // One user's bad data must not starve the rest of the run.
        this.logger.warn(`Notification run failed for user ${user.id}`, err);
      }
    }
  }

  async notifyUser(user: User): Promise<void> {
    if (user.notifyPaymentDue) await this.sendPaymentDueReminders(user);
    if (user.notifyBudgetOverspend) await this.sendBudgetOverspends(user);
  }

  private async sendPaymentDueReminders(user: User): Promise<void> {
    const reminders = await this.reminders.list(user.id);
    const sentKeys = await this.sentKeys(user.id, 'payment_due');
    for (const reminder of reminders) {
      const slot = paymentDueSlot(reminder);
      if (!slot) continue;
      const key = paymentDueKey(reminder, slot);
      if (sentKeys.has(key)) continue;
      const ok = await this.mail.sendPaymentDueEmail(
        user.email,
        user.name,
        {
          accountName: reminder.accountName,
          lastFour: reminder.lastFour,
          dueDate: reminder.dueDate,
          daysUntilDue: reminder.daysUntilDue,
          minimumPayment: reminder.minimumPayment,
          currency: user.currency || 'GTQ',
        },
        user.language,
      );
      if (ok) await this.record(user.id, 'payment_due', key);
    }
  }

  private async sendBudgetOverspends(user: User): Promise<void> {
    const status = await this.budgets.status(user.id, {});
    const sentKeys = await this.sentKeys(user.id, 'budget_overspend');
    const fresh = overspentTargets(status).filter(
      (t) => !sentKeys.has(t.dedupeKey),
    );
    if (fresh.length === 0) return;
    // One email covering every newly crossed limit; each fact still dedupes
    // individually, so a limit crossed later this month gets its own email.
    const ok = await this.mail.sendBudgetOverspendEmail(
      user.email,
      user.name,
      {
        month: status.month,
        currency: status.baseCurrency,
        items: fresh.map(({ categoryName, spent, limit }) => ({
          categoryName,
          spent,
          limit,
        })),
      },
      user.language,
    );
    if (!ok) return;
    for (const t of fresh) {
      await this.record(user.id, 'budget_overspend', t.dedupeKey);
    }
  }

  private async sentKeys(
    userId: string,
    type: NotificationType,
  ): Promise<Set<string>> {
    const rows = await this.sent.find({ where: { userId, type } });
    return new Set(rows.map((r) => r.dedupeKey));
  }

  private async record(
    userId: string,
    type: NotificationType,
    dedupeKey: string,
  ): Promise<void> {
    await this.sent.insert({ userId, type, dedupeKey });
  }
}
