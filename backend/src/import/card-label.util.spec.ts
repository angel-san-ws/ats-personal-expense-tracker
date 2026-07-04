import { correctCardLabel } from './card-label.util';

describe('correctCardLabel', () => {
  const known = ['TCREDITO8', 'TCADICIONAL'];

  it('snaps a single-character OCR confusion to the known label', () => {
    expect(correctCardLabel('TCREDITOS', known)).toBe('TCREDITO8');
    expect(correctCardLabel('TCADICI0NAL', known)).toBe('TCADICIONAL');
  });

  it('keeps a label that already exists (normalizing case)', () => {
    expect(correctCardLabel('TCREDITO8', known)).toBe('TCREDITO8');
    expect(correctCardLabel('tcredito8', known)).toBe('TCREDITO8');
  });

  it('keeps a genuinely new card label', () => {
    expect(correctCardLabel('TDEBITO3', known)).toBe('TDEBITO3');
  });

  it('keeps the OCR value when two known labels are equally close', () => {
    expect(correctCardLabel('TCREDITOS', ['TCREDITO8', 'TCREDITO9'])).toBe(
      'TCREDITOS',
    );
  });

  it('passes null through and handles no known labels', () => {
    expect(correctCardLabel(null, known)).toBeNull();
    expect(correctCardLabel('TCREDITOS', [])).toBe('TCREDITOS');
  });
});
