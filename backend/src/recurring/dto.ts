import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'] as const;

export class CreateRecurringExpenseDto {
  /** Merchant / description (COMERCIO) */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  comercio: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  valor: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsIn(FREQUENCIES)
  frequency: string;

  /** ISO date (yyyy-mm-dd) of the first occurrence */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  /** ISO date (yyyy-mm-dd) inclusive last occurrence bound */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tarjeta?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRecurringExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  comercio?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  valor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsIn(FREQUENCIES)
  frequency?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  /** Empty string clears the end date (open-ended). */
  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/)
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tarjeta?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
