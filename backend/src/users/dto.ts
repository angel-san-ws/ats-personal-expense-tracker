import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX } from '../auth/dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
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
