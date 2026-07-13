import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX } from '../auth/dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** Empty string clears the number. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[\d\s()-]{7,20}$/, {
    message: 'mobilePhone must be a phone number (digits, optional leading +)',
  })
  mobilePhone?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';

  @IsOptional()
  @IsBoolean()
  notifyPaymentDue?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyBudgetOverspend?: boolean;
}

export class SavedFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  card?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  concept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}
