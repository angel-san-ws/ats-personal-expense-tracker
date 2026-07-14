/**
 * Pure decision logic for the daily notification emails: which reminders and
 * budget targets deserve an email today, and the dedupe key that guarantees
 * the same fact is never emailed twice.
 */

import { PaymentReminder } from '../import/payment-reminders.util';
import { BudgetStatus } from '../budgets/budgets.service';

/**
 * A reminder gets at most two emails per cycle: one when it enters the
 * due-soon window (3 days out) and one more if it is still unpaid 1 day
 * before due. Each slot's dedupe key can only be consumed once.
 */
export type PaymentDueSlot = 'initial' | 'final';

/**
 * The email slot a reminder is in today, or null when no email applies
 * (not yet due soon, already paid, or past due — the cycle is over).
 * A user who enables notifications inside the final window gets only the
 * final email, never both on the same day.
 */
export function paymentDueSlot(
  reminder: PaymentReminder,
): PaymentDueSlot | null {
  if (reminder.status !== 'dueSoon') return null;
  return reminder.daysUntilDue <= 1 ? 'final' : 'initial';
}

export function paymentDueKey(
  reminder: PaymentReminder,
  slot: PaymentDueSlot,
): string {
  return `${reminder.accountId}:${reminder.dueDate}:${slot}`;
}

/** A budget target over its monthly limit; `categoryName: null` = overall. */
export interface OverspendTarget {
  dedupeKey: string;
  categoryName: string | null;
  spent: number;
  limit: number;
}

/**
 * Every target currently over its effective limit for the status month.
 * Each target's dedupe key embeds the month, so a category alerts at most
 * once per month even if spending keeps growing.
 */
export function overspentTargets(status: BudgetStatus): OverspendTarget[] {
  const targets: OverspendTarget[] = [];
  const { overall } = status;
  if (
    overall.effectiveAmount !== null &&
    overall.spent > overall.effectiveAmount
  ) {
    targets.push({
      dedupeKey: `overall:${status.month}`,
      categoryName: null,
      spent: overall.spent,
      limit: overall.effectiveAmount,
    });
  }
  for (const c of status.categories) {
    if (c.effectiveAmount !== null && c.spent > c.effectiveAmount) {
      targets.push({
        dedupeKey: `${c.categoryId}:${status.month}`,
        categoryName: c.categoryName,
        spent: c.spent,
        limit: c.effectiveAmount,
      });
    }
  }
  return targets;
}
