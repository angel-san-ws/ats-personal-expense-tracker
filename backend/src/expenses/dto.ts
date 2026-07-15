import { Transform, Type } from 'class-transformer';
import { MAX_TAG_LENGTH, MAX_TAGS } from './tag.util';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export class SetExcludedDto {
  @IsBoolean()
  excluded: boolean;
}

export class CreateExpenseDto {
  /** ISO date (yyyy-mm-dd) */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha: string;

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
  @IsIn(['expense', 'payment'])
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tarjeta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  noTarjeta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoMovimiento?: string;

  /** Payment source (card / bank account) this expense belongs to. */
  @IsOptional()
  @IsUUID()
  accountId?: string;

  /** Assigns the merchant's concept to this category (affects all its expenses). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Free-form labels; normalized (trim/lowercase/dedupe) on save. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  /** Free-text note. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha?: string;

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
  @IsString()
  @MaxLength(80)
  tarjeta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  noTarjeta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoMovimiento?: string;

  /** Payment source this expense belongs to; null detaches it. */
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  /** Assigns the merchant's concept to this category (affects all its expenses). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Free-form labels; normalized (trim/lowercase/dedupe) on save. Empty array clears them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  /** Free-text note; empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class BatchDeleteExpensesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids: string[];
}

export class BatchAssignCategoryDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids: string[];

  /**
   * Assigns the merchants' concepts to this category (affects all their
   * expenses). null / omitted clears the assignment.
   */
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class BatchUpdateExpensesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids: string[];

  /** Empty string clears the card name. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tarjeta?: string;

  /** Empty string clears the card number. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  noTarjeta?: string;

  /** Empty string clears the movement type. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoMovimiento?: string;

  /** Payment source to assign; null detaches the rows from any account. */
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  /** Re-points expense rows at this merchant's concept (and its category). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  comercio?: string;
}

export class ReportQueryDto {
  /** Calendar year to report on (e.g. 2026). Defaults to the current year. */
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;
}

export class QueryExpensesDto {
  /** ISO date (yyyy-mm-dd) inclusive lower bound on FECHA */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** ISO date (yyyy-mm-dd) inclusive upper bound on FECHA */
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** Filter by account (payment source). */
  @IsOptional()
  @IsUUID()
  accountId?: string;

  /** Legacy filter by raw card columns: matches tarjeta or noTarjeta */
  @IsOptional()
  @IsString()
  card?: string;

  /** Free-text search on comercio */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  conceptId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Special value 'none' filters expenses whose concept has no category */
  @IsOptional()
  @IsString()
  categoryFilter?: string;

  /** 'expense' (default) | 'payment' | 'all' */
  @IsOptional()
  @IsIn(['expense', 'payment', 'all'])
  kind?: string;

  /** ISO currency code filter (e.g. GTQ, USD) */
  @IsOptional()
  @IsString()
  currency?: string;

  /**
   * Filter rows carrying ANY of these tags. Accepts a comma-separated value
   * ("tags=a,b") or a repeated param ("tags=a&tags=b").
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const parts = (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === 'string')
      .flatMap((v) => v.split(','))
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return parts.length ? [...new Set(parts)] : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  size?: number = 25;

  @IsOptional()
  @IsIn(['fecha', 'valor', 'comercio', 'tarjeta', 'account'])
  sortField?: string = 'fecha';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string = 'DESC';
}
