import {
  buildManualReminder,
  buildReminder,
  daysBetween,
  ManualReminderSource,
  monthlyDueDates,
  ReminderSource,
} from './payment-reminders.util';

const TODAY = '2026-07-12';

function source(overrides: Partial<ReminderSource> = {}): ReminderSource {
  return {
    accountId: 'acc-1',
    accountName: 'BI Visa 1234',
    accountColor: '#6366f1',
    lastFour: '1234',
    statementDate: '2026-06-30',
    dueDate: '2026-07-20',
    minimumPayment: 850.5,
    pastDueBalance: 0,
    source: 'statement',
    payments: [],
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('counts forward and backward', () => {
    expect(daysBetween('2026-07-12', '2026-07-20')).toBe(8);
    expect(daysBetween('2026-07-12', '2026-07-12')).toBe(0);
    expect(daysBetween('2026-07-12', '2026-07-01')).toBe(-11);
  });

  it('crosses month boundaries', () => {
    expect(daysBetween('2026-06-28', '2026-07-02')).toBe(4);
  });
});

describe('buildReminder', () => {
  it('shows an unpaid statement due within the lookahead window', () => {
    const r = buildReminder(source(), TODAY);
    expect(r).toMatchObject({
      status: 'upcoming',
      daysUntilDue: 8,
      dueDate: '2026-07-20',
      minimumPayment: 850.5,
      paidDate: null,
    });
  });

  it('hides due dates beyond the lookahead window', () => {
    expect(buildReminder(source({ dueDate: '2026-08-15' }), TODAY)).toBeNull();
  });

  it('escalates to dueSoon inside the due-soon threshold, including today', () => {
    expect(
      buildReminder(source({ dueDate: '2026-07-15' }), TODAY)?.status,
    ).toBe('dueSoon');
    const today = buildReminder(source({ dueDate: '2026-07-12' }), TODAY);
    expect(today?.status).toBe('dueSoon');
    expect(today?.daysUntilDue).toBe(0);
  });

  it('flags unpaid past-due statements as overdue', () => {
    const r = buildReminder(
      source({ statementDate: '2026-06-15', dueDate: '2026-07-05' }),
      TODAY,
    );
    expect(r?.status).toBe('overdue');
    expect(r?.daysUntilDue).toBe(-7);
  });

  it('drops overdue reminders older than the keep window', () => {
    const r = buildReminder(
      source({ statementDate: '2026-05-15', dueDate: '2026-06-01' }),
      TODAY,
    );
    expect(r).toBeNull();
  });

  it('marks paid when a payment lands after the statement cut', () => {
    const r = buildReminder(
      source({
        payments: [{ fecha: '2026-07-10', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(r).toMatchObject({
      status: 'paid',
      paidDate: '2026-07-10',
      paidAmount: 900,
      paidCurrency: 'GTQ',
    });
  });

  it('reports the latest covering payment when there are several', () => {
    const r = buildReminder(
      source({
        payments: [
          { fecha: '2026-07-03', valor: 300, currency: 'GTQ' },
          { fecha: '2026-07-10', valor: 600, currency: 'GTQ' },
        ],
      }),
      TODAY,
    );
    expect(r?.paidDate).toBe('2026-07-10');
    expect(r?.paidAmount).toBe(600);
  });

  it('ignores payments on or before the statement cut (previous cycle)', () => {
    const r = buildReminder(
      source({
        payments: [{ fecha: '2026-06-30', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(r?.status).toBe('upcoming');
    expect(r?.paidDate).toBeNull();
  });

  it('falls back to a fixed coverage window when the cut date is unknown', () => {
    const covering = buildReminder(
      source({
        statementDate: null,
        payments: [{ fecha: '2026-06-10', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(covering?.status).toBe('paid');

    const tooOld = buildReminder(
      source({
        statementDate: null,
        payments: [{ fecha: '2026-05-01', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(tooOld?.status).toBe('upcoming');
  });

  it('hides a paid statement once its due date has passed', () => {
    const r = buildReminder(
      source({
        statementDate: '2026-06-15',
        dueDate: '2026-07-05',
        payments: [{ fecha: '2026-07-01', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(r).toBeNull();
  });
});

describe('monthlyDueDates', () => {
  it('picks the next occurrence on or after today', () => {
    expect(monthlyDueDates(20, '2026-07-12')).toEqual({
      prevPrev: '2026-05-20',
      prev: '2026-06-20',
      next: '2026-07-20',
    });
    // Due day already passed this month → next month.
    expect(monthlyDueDates(5, '2026-07-12')).toEqual({
      prevPrev: '2026-06-05',
      prev: '2026-07-05',
      next: '2026-08-05',
    });
    // Today IS the due day.
    expect(monthlyDueDates(12, '2026-07-12').next).toBe('2026-07-12');
  });

  it('clamps the due day to shorter months', () => {
    expect(monthlyDueDates(31, '2026-02-10')).toEqual({
      prevPrev: '2025-12-31',
      prev: '2026-01-31',
      next: '2026-02-28',
    });
    expect(monthlyDueDates(31, '2026-03-01').prev).toBe('2026-02-28');
  });
});

describe('buildManualReminder', () => {
  function manual(
    overrides: Partial<ManualReminderSource> = {},
  ): ManualReminderSource {
    return {
      accountId: 'acc-1',
      accountName: 'BI Visa 1234',
      accountColor: '#6366f1',
      lastFour: '1234',
      minimumPayment: 850.5,
      pastDueBalance: null,
      dueDay: 20,
      payments: [],
      ...overrides,
    };
  }

  it('reminds about the next monthly occurrence', () => {
    const r = buildManualReminder(manual(), TODAY);
    expect(r).toMatchObject({
      status: 'upcoming',
      source: 'manual',
      dueDate: '2026-07-20',
      daysUntilDue: 8,
    });
  });

  it('shows an unpaid previous cycle as overdue until the next one approaches', () => {
    // Due the 5th: July 5 unpaid and Aug 5 still beyond the lookahead → overdue.
    const r = buildManualReminder(manual({ dueDay: 5 }), TODAY);
    expect(r).toMatchObject({ status: 'overdue', dueDate: '2026-07-05' });
  });

  it('rolls an unpaid previous cycle over once the next one enters the window', () => {
    // Due the 20th: June 20 was missed, but July 20 is 8 days out → upcoming.
    const r = buildManualReminder(manual(), TODAY);
    expect(r).toMatchObject({ status: 'upcoming', dueDate: '2026-07-20' });
  });

  it('moves on to the next cycle once the previous one is paid', () => {
    const r = buildManualReminder(
      manual({
        dueDay: 5,
        payments: [{ fecha: '2026-07-03', valor: 500, currency: 'GTQ' }],
      }),
      TODAY,
    );
    // July 5 settled by the July 3 payment; August 5 is beyond the lookahead.
    expect(r).toBeNull();
  });

  it('does not count a previous cycle payment toward the next cycle', () => {
    // Paid June's cycle on June 18; July 20 must still show as unpaid.
    const r = buildManualReminder(
      manual({
        payments: [{ fecha: '2026-06-18', valor: 500, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(r).toMatchObject({
      status: 'upcoming',
      dueDate: '2026-07-20',
      paidDate: null,
    });
  });

  it('marks the upcoming cycle paid when a payment follows the previous occurrence', () => {
    const r = buildManualReminder(
      manual({
        payments: [{ fecha: '2026-07-10', valor: 900, currency: 'GTQ' }],
      }),
      TODAY,
    );
    expect(r).toMatchObject({
      status: 'paid',
      dueDate: '2026-07-20',
      paidDate: '2026-07-10',
    });
  });
});
