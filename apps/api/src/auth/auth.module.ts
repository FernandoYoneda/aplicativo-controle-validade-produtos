import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');

        const expiresInSeconds = Number(
          configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN_SECONDS'),
        );

        if (secret.length < 32) {
          throw new Error(
            'JWT_ACCESS_SECRET deve possuir pelo menos 32 caracteres.',
          );
        }

        if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
          throw new Error(
            'JWT_ACCESS_EXPIRES_IN_SECONDS deve ser um inteiro positivo.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
