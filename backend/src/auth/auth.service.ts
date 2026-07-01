import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/user.mapper';
import { LoginDto, RegisterDto } from './dto';

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.createUser(dto.email, dto.name, dto.password);
    return this.buildResult(user.id, user.email, toPublicUser(user));
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

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
