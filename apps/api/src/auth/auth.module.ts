import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
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
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
