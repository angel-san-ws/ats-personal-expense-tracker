import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

import { AppLanguage, AppTheme, SavedFilter, User } from './user.entity';
import { Category } from '../categories/category.entity';
import { ChangePasswordDto, UpdateProfileDto, UpdateSettingsDto } from './dto';
import { defaultCategoriesFor } from '../common/default-categories';
import { RateStampingService } from '../rates/rate-stamping.service';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly stamping: RateStampingService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(
    email: string,
    name: string,
    password: string,
    language: AppLanguage = 'en',
    theme: AppTheme = 'light',
  ): Promise<User> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalized);
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.users.create({
      email: normalized,
      name: name.trim(),
      passwordHash,
      language,
      theme,
    });
    const saved = await this.users.save(user);
    await this.seedDefaultCategories(saved.id, language);
    return saved;
  }

  /** Account created via Google sign-in — no password; email is Google-verified. */
  async createGoogleUser(
    email: string,
    name: string,
    language: AppLanguage = 'en',
    theme: AppTheme = 'light',
  ): Promise<User> {
    const user = this.users.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: null,
      // Google only issues tokens for verified addresses, so no email round-trip.
      emailVerifiedAt: new Date(),
      language,
      theme,
    });
    const saved = await this.users.save(user);
    await this.seedDefaultCategories(saved.id, language);
    return saved;
  }

  /**
   * Create a fresh verification token for the user and return the raw value
   * (to be emailed). Only its SHA-256 hash is stored; re-issuing invalidates
   * any previous link.
   */
  async issueEmailVerificationToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.users.update(userId, {
      emailVerificationTokenHash: sha256(raw),
      emailVerificationExpiresAt: new Date(
        Date.now() + VERIFICATION_TOKEN_TTL_MS,
      ),
    });
    return raw;
  }

  /** Consume a verification token from an emailed link. */
  async verifyEmailByToken(rawToken: string): Promise<User> {
    const user = await this.users.findOne({
      where: { emailVerificationTokenHash: sha256(rawToken) },
    });
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Verification link is invalid or has expired',
      );
    }
    return this.markEmailVerified(user);
  }

  /**
   * Create a fresh password-reset token for the user and return the raw value
   * (to be emailed). Only its SHA-256 hash is stored; re-issuing invalidates
   * any previous link.
   */
  async issuePasswordResetToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.users.update(userId, {
      passwordResetTokenHash: sha256(raw),
      passwordResetExpiresAt: new Date(
        Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
      ),
    });
    return raw;
  }

  /** Consume a reset token from an emailed link and set the new password. */
  async resetPasswordByToken(
    rawToken: string,
    newPassword: string,
  ): Promise<User> {
    const user = await this.users.findOne({
      where: { passwordResetTokenHash: sha256(rawToken) },
    });
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    // The reset link arrived at the account's address, so ownership is proven.
    user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    return this.users.save(user);
  }

  /** Stamp the email as verified (also used when Google proves ownership). */
  async markEmailVerified(user: User): Promise<User> {
    user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    return this.users.save(user);
  }

  private async seedDefaultCategories(
    userId: string,
    language: AppLanguage,
  ): Promise<void> {
    const rows = defaultCategoriesFor(language).map((c) =>
      this.categories.create({ ...c, userId }),
    );
    await this.categories.save(rows);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.mobilePhone !== undefined) {
      user.mobilePhone = dto.mobilePhone.trim() || null;
    }
    return this.users.save(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<User> {
    const user = await this.findById(userId);
    const previousCurrency = user.currency;
    if (dto.language !== undefined) user.language = dto.language;
    if (dto.currency !== undefined)
      user.currency = dto.currency.trim().toUpperCase();
    if (dto.theme !== undefined) user.theme = dto.theme;
    const saved = await this.users.save(user);
    // Stamped expense rates target the base currency, so a change invalidates
    // them all. Restamp is best-effort — leftovers surface in the dashboard's
    // pending-conversion banner.
    if (saved.currency !== previousCurrency) {
      await this.stamping.restampAll(userId, saved.currency || 'GTQ');
    }
    return saved;
  }

  async saveFilter(
    userId: string,
    key: string,
    filter: SavedFilter,
  ): Promise<User> {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(key)) {
      throw new BadRequestException('Invalid filter key');
    }
    const user = await this.findById(userId);
    user.savedFilters = { ...user.savedFilters, [key]: filter };
    return this.users.save(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findById(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google sign-in and has no password',
      );
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    // A pending reset link must not stay valid for the old request.
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.users.save(user);
  }
}
