import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { AppLanguage, User } from './user.entity';
import { Category } from '../categories/category.entity';
import { ChangePasswordDto, UpdateProfileDto, UpdateSettingsDto } from './dto';
import { defaultCategoriesFor } from '../common/default-categories';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
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
    });
    const saved = await this.users.save(user);
    await this.seedDefaultCategories(saved.id, language);
    return saved;
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
    return this.users.save(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<User> {
    const user = await this.findById(userId);
    if (dto.language !== undefined) user.language = dto.language;
    if (dto.currency !== undefined) user.currency = dto.currency.trim().toUpperCase();
    return this.users.save(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findById(userId);
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
  }
}
