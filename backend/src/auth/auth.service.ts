import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/user.mapper';
import { GoogleLoginDto, LoginDto, RegisterDto } from './dto';

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly googleClientId: string;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID', '');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.createUser(
      dto.email,
      dto.name,
      dto.password,
      dto.language,
      dto.theme,
    );
    return this.buildResult(user.id, user.email, toPublicUser(user));
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    // Google-only accounts have no passwordHash and can't password-login.
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.buildResult(user.id, user.email, toPublicUser(user));
  }

  async googleLogin(dto: GoogleLoginDto): Promise<AuthResult> {
    if (!this.googleClientId)
      throw new UnauthorizedException('Google sign-in is not configured');

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    if (!payload?.email || !payload.email_verified)
      throw new UnauthorizedException('Google account has no verified email');

    // Google verified ownership of the email, so an existing password
    // account with the same address is safe to link (sign into) directly.
    let user = await this.users.findByEmail(payload.email);
    if (!user) {
      user = await this.users.createGoogleUser(
        payload.email,
        payload.name || payload.email.split('@')[0],
        dto.language,
        dto.theme,
      );
    }
    return this.buildResult(user.id, user.email, toPublicUser(user));
  }

  private buildResult(
    sub: string,
    email: string,
    user: PublicUser,
  ): AuthResult {
    const accessToken = this.jwt.sign({ sub, email });
    return { accessToken, user };
  }
}
