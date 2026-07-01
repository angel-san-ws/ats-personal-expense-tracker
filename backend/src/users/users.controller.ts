import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ChangePasswordDto, UpdateProfileDto, UpdateSettingsDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { toPublicUser } from './user.mapper';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    return toPublicUser(await this.users.findById(current.userId));
  }

  @Patch('me/profile')
  async updateProfile(
    @CurrentUser() current: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return toPublicUser(await this.users.updateProfile(current.userId, dto));
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser() current: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return toPublicUser(await this.users.updateSettings(current.userId, dto));
  }

  @Put('me/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() current: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(current.userId, dto);
  }
}
