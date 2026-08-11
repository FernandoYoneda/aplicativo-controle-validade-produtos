import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { UserRole } from '../../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;

  const validPassword = 'valid-password-123';

  const usersServiceMock = {
    findByLoginOrEmail: jest.fn(),
    updateLastLoginAt: jest.fn(),
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
  };

  const configServiceMock = {
    getOrThrow: jest.fn(),
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(validPassword);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    configServiceMock.getOrThrow.mockReturnValue('900');
    usersServiceMock.updateLastLoginAt.mockResolvedValue(undefined);
    jwtServiceMock.signAsync.mockResolvedValue('signed-access-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should issue an access token for valid credentials', async () => {
    const user = {
      id: 'user-id',
      name: 'Administrador',
      email: 'admin@validade.local',
      login: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
      storeId: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date('2026-08-10T10:00:00.000Z'),
      updatedAt: new Date('2026-08-10T10:00:00.000Z'),
    };

    usersServiceMock.findByLoginOrEmail.mockResolvedValue(user);

    const result = await service.login({
      identifier: 'admin',
      password: validPassword,
    });

    expect(usersServiceMock.updateLastLoginAt).toHaveBeenCalledWith('user-id');

    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      role: UserRole.ADMIN,
      storeId: null,
    });

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: 'user-id',
        name: 'Administrador',
        email: 'admin@validade.local',
        login: 'admin',
        role: UserRole.ADMIN,
        storeId: null,
      },
    });
  });

  it('should reject an unknown user', async () => {
    usersServiceMock.findByLoginOrEmail.mockResolvedValue(null);

    await expect(
      service.login({
        identifier: 'unknown',
        password: validPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('should reject an inactive user', async () => {
    usersServiceMock.findByLoginOrEmail.mockResolvedValue({
      id: 'user-id',
      passwordHash,
      isActive: false,
    });

    await expect(
      service.login({
        identifier: 'admin',
        password: validPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('should reject an invalid password', async () => {
    usersServiceMock.findByLoginOrEmail.mockResolvedValue({
      id: 'user-id',
      name: 'Administrador',
      email: 'admin@validade.local',
      login: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
      storeId: null,
      isActive: true,
    });

    await expect(
      service.login({
        identifier: 'admin',
        password: 'incorrect-password',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(usersServiceMock.updateLastLoginAt).not.toHaveBeenCalled();
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
