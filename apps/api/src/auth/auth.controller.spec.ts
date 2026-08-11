import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
import { AuthController } from './auth.controller';
import { AuthService, type LoginResponse } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate login to the auth service', async () => {
    const loginDto = {
      identifier: 'admin',
      password: 'valid-password-123',
    };

    const loginResponse: LoginResponse = {
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
    };

    authServiceMock.login.mockResolvedValue(loginResponse);

    await expect(controller.login(loginDto)).resolves.toEqual(loginResponse);

    expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
  });
});
