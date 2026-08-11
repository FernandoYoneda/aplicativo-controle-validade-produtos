import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../types/authenticated-user';
import type { JwtPayload } from '../types/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    if (secret.length < 32) {
      throw new Error(
        'JWT_ACCESS_SECRET deve possuir pelo menos 32 caracteres.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Token de acesso inválido.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      login: user.login,
      role: user.role,
      storeId: user.storeId,
    };
  }
}
