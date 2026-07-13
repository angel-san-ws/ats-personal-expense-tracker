import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Matches,
} from 'class-validator';

export class UpsertBudgetDto {
  /** Omit (or null) to set the overall budget across all categories. */
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  /** Monthly limit in the user's base currency. */
  @IsNumber()
  @IsPositive()
  amount: number;

  /**
   * Set the amount for this month only (YYYY-MM), overriding the standing
   * budget. Omit (or null) to set the standing amount for every month.
   */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must look like 2026-07',
  })
  month?: string | null;
}

export class BudgetStatusQueryDto {
  /** Month to compute progress for (YYYY-MM). Defaults to the current month. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must look like 2026-07',
  })
  month?: string;
}
