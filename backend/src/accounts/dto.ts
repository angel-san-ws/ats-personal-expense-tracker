import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
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
}
