import { ValueTransformer } from 'typeorm';

/** Postgres numeric/decimal comes back as a string; convert to JS number. */
export class DecimalTransformer implements ValueTransformer {
  to(value: number | null): number | null {
    return value;
  }
  from(value: string | null): number | null {
    return value === null || value === undefined ? null : parseFloat(value);
  }
}

export const decimalTransformer = new DecimalTransformer();
