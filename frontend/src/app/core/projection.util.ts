/**
 * Linear month-end spending projection.
 *
 * Known bias: expense `fecha` is the bank *posting* date, and banks defer
 * weekend transactions to the following Monday, so the elapsed spend lags
 * actual purchases early in the week and the projection slightly understates
 * the real pace. Accepted as-is; no correction applied.
 */

/** Projections during the first days of a month are too noisy to be useful. */
const MIN_DAYS_ELAPSED = 6;

/**
 * Projected month-end spend assuming the pace so far continues linearly:
 * fixedSpent + (spent − fixedSpent) × (daysInMonth / daysElapsed), where
 * daysElapsed is today's day-of-month.
 *
 * `fixedSpent` is the portion of `spent` that is a fixed amount rather than
 * a pace — e.g. expenses generated from recurring templates. Rent posted on
 * the 1st won't repeat all month, so it counts at face value and only the
 * variable remainder is extrapolated.
 *
 * Only defined for the month `today` falls in — past months are already
 * complete and future months have no data — and only from day
 * {@link MIN_DAYS_ELAPSED} onward; returns null otherwise.
 */
export function projectMonthEnd(
  spent: number,
  month: string,
  fixedSpent = 0,
  today: Date = new Date(),
): number | null {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month !== current) return null;
  const daysElapsed = today.getDate();
  if (daysElapsed < MIN_DAYS_ELAPSED) return null;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return fixedSpent + (spent - fixedSpent) * (daysInMonth / daysElapsed);
}

/**
 * Percent of the budget the projection represents (e.g. 118 means on pace to
 * end the month 18% over the limit); null when no positive limit is set.
 */
export function projectionPct(projected: number, limit: number | null): number | null {
  return limit !== null && limit > 0 ? (projected / limit) * 100 : null;
}
