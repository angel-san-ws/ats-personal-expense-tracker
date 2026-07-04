import { Type } from 'class-transformer';
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

  /** Assigns the merchant's concept to this category (affects all its expenses). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;
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

  /** Assigns the merchant's concept to this category (affects all its expenses). */
  @IsOptional()
  @IsUUID()
  categoryId?: string;
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

export class QueryExpensesDto {
  /** ISO date (yyyy-mm-dd) inclusive lower bound on FECHA */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** ISO date (yyyy-mm-dd) inclusive upper bound on FECHA */
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** Filter by card: matches tarjeta or noTarjeta */
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
  @IsIn(['fecha', 'valor', 'comercio', 'tarjeta'])
  sortField?: string = 'fecha';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string = 'DESC';
}
