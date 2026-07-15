/** Max tags kept per expense. */
export const MAX_TAGS = 10;
/** Max characters kept per tag. */
export const MAX_TAG_LENGTH = 30;

/**
 * Normalize user-entered tags: trim, lowercase, drop empties and duplicates.
 * Commas act as separators (they are also the wire separator in the tags
 * query filter, so they can never be part of a tag). Caps the result at
 * MAX_TAGS entries of MAX_TAG_LENGTH characters each.
 */
export function normalizeTags(tags: string[] | null | undefined): string[] {
  if (!tags) return [];
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    for (const part of raw.split(',')) {
      const tag = part.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
      if (tag && !out.includes(tag)) out.push(tag);
    }
  }
  return out.slice(0, MAX_TAGS);
}
