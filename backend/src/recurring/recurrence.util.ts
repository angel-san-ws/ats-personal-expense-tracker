import { RecurrenceFrequency } from './recurring-expense.entity';

const DAY_MS = 86_400_000;

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toUtc(iso).getTime() + days * DAY_MS));
}

/** Today's date in server-local time as yyyy-mm-dd. */
export function localTodayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * n-th occurrence (0-based) of a schedule anchored at startIso.
 * Monthly/yearly keep the anchor's day-of-month, clamped to shorter
 * months (Jan 31 -> Feb 28 -> Mar 31, no drift).
 */
export function occurrence(
  startIso: string,
  frequency: RecurrenceFrequency,
  n: number,
): string {
  const start = toUtc(startIso);
  switch (frequency) {
    case 'weekly':
      return addDays(startIso, n * 7);
    case 'biweekly':
      return addDays(startIso, n * 14);
    case 'monthly': {
      const months = start.getUTCMonth() + n;
      const year = start.getUTCFullYear() + Math.floor(months / 12);
      const month0 = ((months % 12) + 12) % 12;
      const day = Math.min(start.getUTCDate(), daysInMonth(year, month0));
      return toIso(new Date(Date.UTC(year, month0, day)));
    }
    case 'yearly': {
      const year = start.getUTCFullYear() + n;
      const month0 = start.getUTCMonth();
      const day = Math.min(start.getUTCDate(), daysInMonth(year, month0));
      return toIso(new Date(Date.UTC(year, month0, day)));
    }
  }
}

/** Smallest occurrence >= fromIso. */
export function nextOccurrenceOnOrAfter(
  startIso: string,
  frequency: RecurrenceFrequency,
  fromIso: string,
): string {
  if (fromIso <= startIso) return startIso;

  // Lower-bound estimate one period short, then walk forward.
  const start = toUtc(startIso);
  const from = toUtc(fromIso);
  let n: number;
  switch (frequency) {
    case 'weekly':
      n = Math.floor((from.getTime() - start.getTime()) / (7 * DAY_MS)) - 1;
      break;
    case 'biweekly':
      n = Math.floor((from.getTime() - start.getTime()) / (14 * DAY_MS)) - 1;
      break;
    case 'monthly':
      n =
        (from.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (from.getUTCMonth() - start.getUTCMonth()) -
        1;
      break;
    case 'yearly':
      n = from.getUTCFullYear() - start.getUTCFullYear() - 1;
      break;
  }
  n = Math.max(0, n);
  while (occurrence(startIso, frequency, n) < fromIso) n++;
  return occurrence(startIso, frequency, n);
}

/** Smallest occurrence strictly after afterIso. */
export function nextOccurrenceAfter(
  startIso: string,
  frequency: RecurrenceFrequency,
  afterIso: string,
): string {
  return nextOccurrenceOnOrAfter(startIso, frequency, addDays(afterIso, 1));
}
