import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const STRONG_PASSWORD_MESSAGE =
  'password must contain at least one uppercase letter, one lowercase letter, one number and one special character';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  password: string;

  /** UI language; also decides the language of the seeded default categories. */
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';

  /** Browser-detected theme, sent silently so the account matches what the user saw. */
  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class VerifyEmailDto {
  /** Raw verification token from the emailed link. */
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;
}

export class GoogleLoginDto {
  /** Google ID token (JWT) issued by Google Identity Services. */
  @IsString()
  credential: string;

  /** Used only when the sign-in creates a new account. */
  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';

  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';
}
