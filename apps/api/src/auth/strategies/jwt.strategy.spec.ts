import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../generated/prisma/enums';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayload } from '../types/jwt-payload';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const usersServiceMock = {
    findActiveById: jest.fn(),
  };

  const payload: JwtPayload = {
    sub: 'user-id',
    role: UserRole.ADMIN,
    storeId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_ACCESS_SECRET: 'a'.repeat(64),
          }),
        },
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return the active authenticated user', async () => {
    usersServiceMock.findActiveById.mockResolvedValue({
      id: 'user-id',
      name: 'Administrador',
      email: 'admin@validade.local',
      login: 'admin',
      passwordHash: 'argon2-hash',
      role: UserRole.ADMIN,
      storeId: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'user-id',
      name: 'Administrador',
      email: 'admin@validade.local',
      login: 'admin',
      role: UserRole.ADMIN,
      storeId: null,
    });

    expect(usersServiceMock.findActiveById).toHaveBeenCalledWith('user-id');
  });

  it('should reject a token when the active user is not found', async () => {
    usersServiceMock.findActiveById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
