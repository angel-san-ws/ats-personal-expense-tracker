import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './current-user.decorator';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.mapper';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto);
  }

  /** Public: emails a password-reset link. Always reports success so the
   * response doesn't reveal whether the address is registered. */
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto);
    return { sent: true };
  }

  /** Public: consumes the token from the emailed reset link. */
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const user = await this.users.resetPasswordByToken(dto.token, dto.password);
    return { reset: true, email: user.email };
  }

  /** Public: consumes the token from the emailed verification link. */
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const user = await this.users.verifyEmailByToken(dto.token);
    return { verified: true, email: user.email };
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  async resendVerification(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.userId);
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true };
    const sent = await this.auth.sendVerification(user);
    return { sent, alreadyVerified: false };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.userId);
    return toPublicUser(user);
  }
}
