/**
 * OCR reads card labels with occasional single-character confusions
 * (8↔S, 0↔O, 1↔I), e.g. "TCREDITO8" → "TCREDITOS". Snap an OCR'd label to
 * the user's known card labels when it is unambiguously one edit away.
 */

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Return the known label the OCR'd `label` should snap to:
 * - `label` already known (case-insensitively) → itself (known casing);
 * - exactly one known label at edit distance 1 → that label;
 * - otherwise (new card, or ambiguous between several) → `label` unchanged.
 */
export function correctCardLabel(
  label: string | null,
  knownLabels: string[],
): string | null {
  if (!label) return label;
  const upper = label.toUpperCase();

  const exact = knownLabels.find((k) => k.toUpperCase() === upper);
  if (exact) return exact;

  const near = knownLabels.filter(
    (k) => editDistance(k.toUpperCase(), upper) === 1,
  );
  return near.length === 1 ? near[0] : label;
}
