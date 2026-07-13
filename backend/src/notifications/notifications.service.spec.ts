import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { SentNotification } from './sent-notification.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { BudgetsService, BudgetStatus } from '../budgets/budgets.service';
import { PaymentRemindersService } from '../import/payment-reminders.service';
import { PaymentReminder } from '../import/payment-reminders.util';

describe('NotificationsService', () => {
  let usersFind: jest.Mock;
  let sentFind: jest.Mock;
  let sentInsert: jest.Mock;
  let remindersList: jest.Mock;
  let budgetsStatus: jest.Mock;
  let sendPaymentDueEmail: jest.Mock;
  let sendBudgetOverspendEmail: jest.Mock;
  let service: NotificationsService;

  const user = (overrides: Partial<User> = {}): User =>
    ({
      id: 'u1',
      email: 'u1@example.com',
      name: 'Ana',
      language: 'en',
      currency: 'GTQ',
      notifyPaymentDue: true,
      notifyBudgetOverspend: true,
      ...overrides,
    }) as User;

  const reminder = (overrides: Partial<PaymentReminder> = {}): PaymentReminder => ({
    accountId: 'acc-1',
    accountName: 'BAM Visa',
    accountColor: null,
    lastFour: '1234',
    dueDate: '2026-07-16',
    statementDate: '2026-06-28',
    minimumPayment: 500,
    pastDueBalance: null,
    daysUntilDue: 3,
    status: 'dueSoon',
    source: 'statement',
    paidDate: null,
    paidAmount: null,
    paidCurrency: null,
    ...overrides,
  });

  const status = (overrides: Partial<BudgetStatus> = {}): BudgetStatus => ({
    month: '2026-07',
    baseCurrency: 'GTQ',
    unconvertedCount: 0,
    overall: {
      budgetId: null,
      amount: null,
      overrideId: null,
      overrideAmount: null,
      effectiveAmount: null,
      spent: 0,
    },
    categories: [],
    ...overrides,
  });

  const category = (
    id: string,
    name: string,
    spent: number,
    limit: number | null,
  ) => ({
    categoryId: id,
    categoryName: name,
    color: '#f00',
    budgetId: limit === null ? null : `b-${id}`,
    amount: limit,
    overrideId: null,
    overrideAmount: null,
    effectiveAmount: limit,
    spent,
  });

  beforeEach(() => {
    usersFind = jest.fn().mockResolvedValue([]);
    sentFind = jest.fn().mockResolvedValue([]);
    sentInsert = jest.fn().mockResolvedValue(undefined);
    remindersList = jest.fn().mockResolvedValue([]);
    budgetsStatus = jest.fn().mockResolvedValue(status());
    sendPaymentDueEmail = jest.fn().mockResolvedValue(true);
    sendBudgetOverspendEmail = jest.fn().mockResolvedValue(true);

    service = new NotificationsService(
      { find: usersFind } as unknown as Repository<User>,
      {
        find: sentFind,
        insert: sentInsert,
      } as unknown as Repository<SentNotification>,
      { list: remindersList } as unknown as PaymentRemindersService,
      { status: budgetsStatus } as unknown as BudgetsService,
      {
        sendPaymentDueEmail,
        sendBudgetOverspendEmail,
      } as unknown as MailService,
    );
  });

  describe('payment due reminders', () => {
    it('emails a due-soon reminder and records the initial slot', async () => {
      remindersList.mockResolvedValue([reminder({ daysUntilDue: 3 })]);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sendPaymentDueEmail).toHaveBeenCalledWith(
        'u1@example.com',
        'Ana',
        expect.objectContaining({
          accountName: 'BAM Visa',
          dueDate: '2026-07-16',
          daysUntilDue: 3,
          minimumPayment: 500,
          currency: 'GTQ',
        }),
        'en',
      );
      expect(sentInsert).toHaveBeenCalledWith({
        userId: 'u1',
        type: 'payment_due',
        dedupeKey: 'acc-1:2026-07-16:initial',
      });
    });

    it('does not resend an already-notified slot', async () => {
      remindersList.mockResolvedValue([reminder({ daysUntilDue: 2 })]);
      sentFind.mockResolvedValue([
        { dedupeKey: 'acc-1:2026-07-16:initial' },
      ]);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sendPaymentDueEmail).not.toHaveBeenCalled();
      expect(sentInsert).not.toHaveBeenCalled();
    });

    it('resends once more when still unpaid 1 day before due', async () => {
      remindersList.mockResolvedValue([reminder({ daysUntilDue: 1 })]);
      sentFind.mockResolvedValue([
        { dedupeKey: 'acc-1:2026-07-16:initial' },
      ]);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sendPaymentDueEmail).toHaveBeenCalledTimes(1);
      expect(sentInsert).toHaveBeenCalledWith({
        userId: 'u1',
        type: 'payment_due',
        dedupeKey: 'acc-1:2026-07-16:final',
      });
    });

    it('sends a single email when first eligible inside the final window', async () => {
      remindersList.mockResolvedValue([reminder({ daysUntilDue: 0 })]);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sendPaymentDueEmail).toHaveBeenCalledTimes(1);
      expect(sentInsert).toHaveBeenCalledTimes(1);
      expect(sentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'acc-1:2026-07-16:final' }),
      );
    });

    it('ignores reminders that are paid, upcoming or overdue', async () => {
      remindersList.mockResolvedValue([
        reminder({ status: 'paid', daysUntilDue: 2 }),
        reminder({ status: 'upcoming', daysUntilDue: 10 }),
        reminder({ status: 'overdue', daysUntilDue: -2 }),
      ]);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sendPaymentDueEmail).not.toHaveBeenCalled();
    });

    it('does not record the send when the mailer fails (retries next run)', async () => {
      remindersList.mockResolvedValue([reminder({ daysUntilDue: 3 })]);
      sendPaymentDueEmail.mockResolvedValue(false);

      await service.notifyUser(user({ notifyBudgetOverspend: false }));

      expect(sentInsert).not.toHaveBeenCalled();
    });

    it('skips the whole check when the user opted out', async () => {
      await service.notifyUser(
        user({ notifyPaymentDue: false, notifyBudgetOverspend: false }),
      );
      expect(remindersList).not.toHaveBeenCalled();
      expect(budgetsStatus).not.toHaveBeenCalled();
    });
  });

  describe('budget overspend alerts', () => {
    it('emails newly crossed limits in one message and records each key', async () => {
      budgetsStatus.mockResolvedValue(
        status({
          categories: [
            category('cat-1', 'Food', 620, 500),
            category('cat-2', 'Transport', 100, 300),
            category('cat-3', 'Fun', 90, null),
          ],
        }),
      );

      await service.notifyUser(user({ notifyPaymentDue: false }));

      expect(sendBudgetOverspendEmail).toHaveBeenCalledTimes(1);
      expect(sendBudgetOverspendEmail).toHaveBeenCalledWith(
        'u1@example.com',
        'Ana',
        {
          month: '2026-07',
          currency: 'GTQ',
          items: [{ categoryName: 'Food', spent: 620, limit: 500 }],
        },
        'en',
      );
      expect(sentInsert).toHaveBeenCalledWith({
        userId: 'u1',
        type: 'budget_overspend',
        dedupeKey: 'cat-1:2026-07',
      });
    });

    it('includes the overall budget with its own dedupe key', async () => {
      budgetsStatus.mockResolvedValue(
        status({
          overall: {
            budgetId: 'b-all',
            amount: 1000,
            overrideId: null,
            overrideAmount: null,
            effectiveAmount: 1000,
            spent: 1200,
          },
          categories: [category('cat-1', 'Food', 620, 500)],
        }),
      );

      await service.notifyUser(user({ notifyPaymentDue: false }));

      const items = sendBudgetOverspendEmail.mock.calls[0][2].items;
      expect(items).toEqual([
        { categoryName: null, spent: 1200, limit: 1000 },
        { categoryName: 'Food', spent: 620, limit: 500 },
      ]);
      expect(sentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'overall:2026-07' }),
      );
      expect(sentInsert).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'cat-1:2026-07' }),
      );
    });

    it('alerts a category at most once per month', async () => {
      budgetsStatus.mockResolvedValue(
        status({ categories: [category('cat-1', 'Food', 620, 500)] }),
      );
      sentFind.mockResolvedValue([{ dedupeKey: 'cat-1:2026-07' }]);

      await service.notifyUser(user({ notifyPaymentDue: false }));

      expect(sendBudgetOverspendEmail).not.toHaveBeenCalled();
      expect(sentInsert).not.toHaveBeenCalled();
    });

    it('stays silent while every target is within its limit', async () => {
      budgetsStatus.mockResolvedValue(
        status({ categories: [category('cat-1', 'Food', 499, 500)] }),
      );

      await service.notifyUser(user({ notifyPaymentDue: false }));

      expect(sendBudgetOverspendEmail).not.toHaveBeenCalled();
    });

    it('does not record the keys when the mailer fails (retries next run)', async () => {
      budgetsStatus.mockResolvedValue(
        status({ categories: [category('cat-1', 'Food', 620, 500)] }),
      );
      sendBudgetOverspendEmail.mockResolvedValue(false);

      await service.notifyUser(user({ notifyPaymentDue: false }));

      expect(sentInsert).not.toHaveBeenCalled();
    });
  });

  describe('runDaily', () => {
    it('keeps processing other users when one fails', async () => {
      const failing = user({ id: 'u-bad', notifyBudgetOverspend: false });
      const healthy = user({
        id: 'u-ok',
        email: 'ok@example.com',
        notifyBudgetOverspend: false,
      });
      usersFind.mockResolvedValue([failing, healthy]);
      remindersList
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce([reminder({ daysUntilDue: 3 })]);

      await service.runDaily();

      expect(sendPaymentDueEmail).toHaveBeenCalledTimes(1);
      expect(sendPaymentDueEmail).toHaveBeenCalledWith(
        'ok@example.com',
        'Ana',
        expect.anything(),
        'en',
      );
    });
  });
});
