import { projectMonthEnd, projectionPct } from './projection.util';

describe('projectMonthEnd', () => {
  // June 2026 has 30 days.
  const june15 = new Date(2026, 5, 15);

  it('projects the month-end total linearly from the pace so far', () => {
    // Q 500 in 15 of 30 days → Q 1,000 by month end.
    expect(projectMonthEnd(500, '2026-06', 0, june15)).toBeCloseTo(1000);
    // 31-day month: Q 620 in 20 of 31 days → 620 * 31/20 = 961.
    expect(projectMonthEnd(620, '2026-07', 0, new Date(2026, 6, 20))).toBeCloseTo(961);
  });

  it('counts fixed (recurring-generated) spend at face value', () => {
    // Q 200 fixed + Q 300 variable in 15 of 30 days → 200 + 300 × 2 = 800.
    expect(projectMonthEnd(500, '2026-06', 200, june15)).toBeCloseTo(800);
    // All spend fixed → the projection is just the spend itself.
    expect(projectMonthEnd(200, '2026-06', 200, june15)).toBeCloseTo(200);
  });

  it('is suppressed during the first 5 days of the month', () => {
    for (let day = 1; day <= 5; day++) {
      expect(projectMonthEnd(500, '2026-06', 0, new Date(2026, 5, day))).toBeNull();
    }
    expect(projectMonthEnd(500, '2026-06', 0, new Date(2026, 5, 6))).toBeCloseTo(2500);
  });

  it('returns null for a past month', () => {
    expect(projectMonthEnd(500, '2026-05', 0, june15)).toBeNull();
    expect(projectMonthEnd(500, '2025-06', 0, june15)).toBeNull();
  });

  it('returns null for a future month', () => {
    expect(projectMonthEnd(500, '2026-07', 0, june15)).toBeNull();
    expect(projectMonthEnd(500, '2027-06', 0, june15)).toBeNull();
  });

  it('matches the spend on the last day of the month', () => {
    expect(projectMonthEnd(750, '2026-06', 0, new Date(2026, 5, 30))).toBeCloseTo(750);
    expect(projectMonthEnd(750, '2026-06', 300, new Date(2026, 5, 30))).toBeCloseTo(750);
  });
});

describe('projectionPct', () => {
  it('is above 100 when on pace to exceed the budget', () => {
    expect(projectionPct(1180, 1000)).toBeCloseTo(118);
  });

  it('is at most 100 when within the budget', () => {
    expect(projectionPct(800, 1000)).toBeCloseTo(80);
    expect(projectionPct(1000, 1000)).toBeCloseTo(100);
  });

  it('returns null when no positive limit is set', () => {
    expect(projectionPct(500, null)).toBeNull();
    expect(projectionPct(500, 0)).toBeNull();
  });
});
