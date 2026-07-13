import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ACCOUNT_TYPES } from './account.entity';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsIn([...ACCOUNT_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  lastFour?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  creditLimit?: number;

  /** Day of month (1–31) the payment is due; enables manual reminders. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number | null;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn([...ACCOUNT_TYPES])
  type?: string;

  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  lastFour?: string;

  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  institution?: string;

  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  creditLimit?: number;

  /** Day of month (1–31); null clears it and stops manual reminders. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number | null;
}
