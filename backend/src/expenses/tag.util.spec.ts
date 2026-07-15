import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTags } from './tag.util';

describe('normalizeTags', () => {
  it('trims and lowercases each tag', () => {
    expect(normalizeTags(['  Vacation-2026 ', 'REIMBURSABLE'])).toEqual([
      'vacation-2026',
      'reimbursable',
    ]);
  });

  it('drops empty and whitespace-only entries', () => {
    expect(normalizeTags(['', '   ', 'trip'])).toEqual(['trip']);
  });

  it('dedupes tags that normalize to the same value, keeping first position', () => {
    expect(normalizeTags(['Trip', 'work', ' TRIP '])).toEqual([
      'trip',
      'work',
    ]);
  });

  it('treats commas as separators (commas can never be part of a tag)', () => {
    expect(normalizeTags(['a,b', ' c , '])).toEqual(['a', 'b', 'c']);
  });

  it(`caps the result at ${MAX_TAGS} tags`, () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag-${i}`);
    const result = normalizeTags(many);
    expect(result).toHaveLength(MAX_TAGS);
    expect(result[0]).toBe('tag-0');
  });

  it(`truncates tags longer than ${MAX_TAG_LENGTH} characters`, () => {
    const long = 'x'.repeat(MAX_TAG_LENGTH + 10);
    expect(normalizeTags([long])).toEqual(['x'.repeat(MAX_TAG_LENGTH)]);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
  });
});
