import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { UserRole } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  storeId: string | null;
}

interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  login: string;
  role: UserRole;
  storeId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresInSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessTokenExpiresInSeconds = Number(
      configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN_SECONDS'),
    );
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByLoginOrEmail(
      loginDto.identifier,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Identificador ou senha inválidos.');
    }

    const passwordMatches = await this.verifyPassword(
      user.passwordHash,
      loginDto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Identificador ou senha inválidos.');
    }

    await this.usersService.updateLastLoginAt(user.id);

    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      storeId: user.storeId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        login: user.login,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }

  private async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
