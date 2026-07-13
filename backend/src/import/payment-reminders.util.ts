/**
 * Pure decision logic for payment due-date reminders. A reminder is derived
 * from an account's most recent imported statement (its `paymentDueDate`)
 * and is considered settled once a payment row is posted after the
 * statement cut. All dates are ISO `YYYY-MM-DD` strings.
 */

/** Start showing a reminder this many days before the due date. */
export const REMINDER_LOOKAHEAD_DAYS = 15;
/** Keep an unpaid, overdue reminder visible this many days past due. */
export const REMINDER_OVERDUE_KEEP_DAYS = 30;
/** At or under this many days to the due date, escalate to "due soon". */
export const REMINDER_DUE_SOON_DAYS = 3;
/**
 * When the statement has no cut date, payments up to this many days before
 * the due date still count as covering the cycle (cuts usually run 20–25
 * days before the due date, so 45 is a safe upper bound).
 */
export const REMINDER_FALLBACK_COVERAGE_DAYS = 45;

export type ReminderStatus = 'upcoming' | 'dueSoon' | 'overdue' | 'paid';

/**
 * Where the due date came from: an imported statement's exact date, or the
 * account's user-configured monthly due day.
 */
export type ReminderOrigin = 'statement' | 'manual';

export interface ReminderPayment {
  fecha: string;
  valor: number;
  currency: string;
}

/** One account's latest statement data plus its recent payment rows. */
export interface ReminderSource {
  accountId: string;
  accountName: string;
  accountColor: string | null;
  lastFour: string | null;
  statementDate: string | null;
  dueDate: string;
  minimumPayment: number | null;
  pastDueBalance: number | null;
  source: ReminderOrigin;
  payments: ReminderPayment[];
}

export interface PaymentReminder {
  accountId: string;
  accountName: string;
  accountColor: string | null;
  lastFour: string | null;
  dueDate: string;
  statementDate: string | null;
  minimumPayment: number | null;
  pastDueBalance: number | null;
  /** Negative once the due date has passed. */
  daysUntilDue: number;
  status: ReminderStatus;
  source: ReminderOrigin;
  paidDate: string | null;
  paidAmount: number | null;
  paidCurrency: string | null;
}

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in the server's local timezone. */
export function localTodayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Build the reminder for one account, or null when nothing should be shown:
 * the due date is too far out, the reminder went stale, or the statement was
 * paid and its due date already passed.
 */
export function buildReminder(
  src: ReminderSource,
  today: string,
): PaymentReminder | null {
  const daysUntilDue = daysBetween(today, src.dueDate);
  if (daysUntilDue > REMINDER_LOOKAHEAD_DAYS) return null;
  if (daysUntilDue < -REMINDER_OVERDUE_KEEP_DAYS) return null;

  // A payment posted strictly after the statement cut belongs to this cycle
  // (one dated on the cut itself is already reflected in the statement).
  const paid = src.payments
    .filter((p) =>
      src.statementDate
        ? p.fecha > src.statementDate
        : p.fecha >= addDays(src.dueDate, -REMINDER_FALLBACK_COVERAGE_DAYS),
    )
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];

  // Settled and past due — the cycle is over, nothing left to remind.
  if (paid && daysUntilDue < 0) return null;

  const status: ReminderStatus = paid
    ? 'paid'
    : daysUntilDue < 0
      ? 'overdue'
      : daysUntilDue <= REMINDER_DUE_SOON_DAYS
        ? 'dueSoon'
        : 'upcoming';

  return {
    accountId: src.accountId,
    accountName: src.accountName,
    accountColor: src.accountColor,
    lastFour: src.lastFour,
    dueDate: src.dueDate,
    statementDate: src.statementDate,
    minimumPayment: src.minimumPayment,
    pastDueBalance: src.pastDueBalance,
    daysUntilDue,
    status,
    source: src.source,
    paidDate: paid?.fecha ?? null,
    paidAmount: paid?.valor ?? null,
    paidCurrency: paid?.currency ?? null,
  };
}

/** `dueDay` in the given month, clamped to the month's length (31 → Feb 28). */
function occurrenceIn(
  year: number,
  monthIndex0: number,
  dueDay: number,
): string {
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex0, Math.min(dueDay, lastDay)))
    .toISOString()
    .slice(0, 10);
}

/**
 * The monthly cycle dates around `today` for a user-configured due day:
 * `next` is the first occurrence on/after today, `prev`/`prevPrev` the two
 * before it.
 */
export function monthlyDueDates(
  dueDay: number,
  today: string,
): { prevPrev: string; prev: string; next: string } {
  const [year, month] = today.split('-').map(Number);
  const dates: string[] = [];
  for (let offset = -3; offset <= 1; offset++) {
    dates.push(occurrenceIn(year, month - 1 + offset, dueDay));
  }
  const i = dates.findIndex((d) => d >= today);
  return { prevPrev: dates[i - 2], prev: dates[i - 1], next: dates[i] };
}

/** Manual reminder input: a monthly due day instead of statement dates. */
export type ManualReminderSource = Omit<
  ReminderSource,
  'dueDate' | 'statementDate' | 'source' | 'minimumPayment'
> & { dueDay: number };

/**
 * Reminder for an account's user-configured monthly due day. Each cycle's
 * coverage starts at the previous occurrence (mirroring statement cuts).
 * The upcoming cycle is evaluated first: once it enters the lookahead
 * window it takes over, so a missed previous cycle only shows as overdue
 * until then — a manual due day proves nothing was owed, so it must not
 * nag "overdue" forever the way an unpaid statement would.
 */
export function buildManualReminder(
  src: ManualReminderSource,
  today: string,
): PaymentReminder | null {
  const { prevPrev, prev, next } = monthlyDueDates(src.dueDay, today);
  const cycle = (dueDate: string, statementDate: string): ReminderSource => ({
    ...src,
    dueDate,
    statementDate,
    minimumPayment: null,
    source: 'manual',
  });
  return (
    buildReminder(cycle(next, prev), today) ??
    buildReminder(cycle(prev, prevPrev), today)
  );
}
