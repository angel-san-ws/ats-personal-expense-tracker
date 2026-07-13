import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';

import { ImportBatch } from './import-batch.entity';
import { Expense } from '../expenses/expense.entity';
import { Account } from '../accounts/account.entity';
import {
  addDays,
  buildManualReminder,
  buildReminder,
  localTodayIso,
  monthlyDueDates,
  PaymentReminder,
  ReminderPayment,
  REMINDER_FALLBACK_COVERAGE_DAYS,
} from './payment-reminders.util';

/** Raw row: an account's latest statement that carries a payment due date. */
interface BatchRow {
  accountId: string;
  accountName: string;
  accountColor: string | null;
  lastFour: string | null;
  statementDate: string | null;
  dueDate: string;
  minimumPayment: string | null;
  pastDueBalance: string | null;
}

interface PaymentRow {
  accountId: string;
  fecha: string;
  valor: string;
  currency: string;
}

@Injectable()
export class PaymentRemindersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Due-date reminders for the user's active accounts, ordered by due date.
   * Two sources per account, exact statement data winning over the manual
   * setting:
   * - the most recent imported statement with a payment due date;
   * - the account's user-configured monthly due day (`paymentDueDay`).
   * Either way a reminder settles when a payment is registered after the
   * cycle's start (statement cut / previous monthly occurrence).
   */
  async list(
    userId: string,
    today = localTodayIso(),
  ): Promise<PaymentReminder[]> {
    const batches = await this.latestBatches(userId);
    const manualAccounts = await this.dataSource.getRepository(Account).find({
      where: { userId, archived: false, paymentDueDay: Not(IsNull()) },
    });
    if (batches.length === 0 && manualAccounts.length === 0) return [];

    const paymentsByAccount = await this.recentPayments(
      userId,
      batches,
      manualAccounts,
      today,
    );

    const byAccount = new Map<string, PaymentReminder>();
    for (const b of batches) {
      const reminder = buildReminder(
        {
          accountId: b.accountId,
          accountName: b.accountName,
          accountColor: b.accountColor,
          lastFour: b.lastFour,
          statementDate: b.statementDate,
          dueDate: b.dueDate,
          minimumPayment: b.minimumPayment ? Number(b.minimumPayment) : null,
          pastDueBalance: b.pastDueBalance ? Number(b.pastDueBalance) : null,
          source: 'statement',
          payments: paymentsByAccount.get(b.accountId) ?? [],
        },
        today,
      );
      if (reminder) byAccount.set(b.accountId, reminder);
    }

    // Manual due days only fill in where no statement reminder is active, so
    // a freshly imported statement always shows the bank's exact date.
    for (const a of manualAccounts) {
      if (byAccount.has(a.id)) continue;
      const reminder = buildManualReminder(
        {
          accountId: a.id,
          accountName: a.name,
          accountColor: a.color,
          lastFour: a.lastFour,
          minimumPayment: a.paymentAmount,
          pastDueBalance: null,
          dueDay: a.paymentDueDay!,
          payments: paymentsByAccount.get(a.id) ?? [],
        },
        today,
      );
      if (reminder) byAccount.set(a.id, reminder);
    }

    return [...byAccount.values()].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
  }

  /** Per account, the newest imported statement carrying a due date. */
  private latestBatches(userId: string): Promise<BatchRow[]> {
    return this.dataSource
      .getRepository(ImportBatch)
      .createQueryBuilder('b')
      .innerJoin(
        Expense,
        'e',
        'e.import_batch_id = b.id AND e.account_id IS NOT NULL',
      )
      .innerJoin(Account, 'a', 'a.id = e.account_id')
      .distinctOn(['e.account_id'])
      .select('e.account_id', 'accountId')
      .addSelect('a.name', 'accountName')
      .addSelect('a.color', 'accountColor')
      .addSelect('a.last_four', 'lastFour')
      // ::text keeps dates as plain YYYY-MM-DD instead of JS Dates.
      .addSelect('b.statement_date::text', 'statementDate')
      .addSelect('b.payment_due_date::text', 'dueDate')
      .addSelect('b.minimum_payment', 'minimumPayment')
      .addSelect('b.past_due_balance', 'pastDueBalance')
      .where('b.user_id = :userId', { userId })
      .andWhere('b.payment_due_date IS NOT NULL')
      .andWhere('a.archived = false')
      .orderBy('e.account_id')
      .addOrderBy('b.payment_due_date', 'DESC')
      .addOrderBy('b.imported_at', 'DESC')
      .getRawMany();
  }

  /** Payments per account since the earliest possible cycle coverage. */
  private async recentPayments(
    userId: string,
    batches: BatchRow[],
    manualAccounts: Account[],
    today: string,
  ): Promise<Map<string, ReminderPayment[]>> {
    const coverageStarts = [
      ...batches.map(
        (b) =>
          b.statementDate ??
          addDays(b.dueDate, -REMINDER_FALLBACK_COVERAGE_DAYS),
      ),
      ...manualAccounts.map(
        (a) => monthlyDueDates(a.paymentDueDay!, today).prevPrev,
      ),
    ];
    const earliest = coverageStarts.sort()[0];
    const accountIds = [
      ...new Set([
        ...batches.map((b) => b.accountId),
        ...manualAccounts.map((a) => a.id),
      ]),
    ];

    const rows: PaymentRow[] = await this.dataSource
      .getRepository(Expense)
      .createQueryBuilder('e')
      .select('e.account_id', 'accountId')
      .addSelect('e.fecha::text', 'fecha')
      .addSelect('e.valor', 'valor')
      .addSelect('e.currency', 'currency')
      .where('e.user_id = :userId', { userId })
      .andWhere("e.kind = 'payment'")
      .andWhere('e.account_id IN (:...accountIds)', { accountIds })
      .andWhere('e.fecha >= :earliest', { earliest })
      .getRawMany();

    const byAccount = new Map<string, ReminderPayment[]>();
    for (const row of rows) {
      const list = byAccount.get(row.accountId) ?? [];
      list.push({
        fecha: row.fecha,
        valor: Number(row.valor),
        currency: row.currency,
      });
      byAccount.set(row.accountId, list);
    }
    return byAccount;
  }
}
