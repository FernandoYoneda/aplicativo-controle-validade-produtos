import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
import { UsersController } from './users.controller';
import { type StoreUserResponse, UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const storeId = '10000000-0000-4000-8000-000000000001';
  const userId = '20000000-0000-4000-8000-000000000001';

  const storeUserResponse: StoreUserResponse = {
    id: userId,
    name: 'Usuário da Loja',
    email: 'usuario@validade.local',
    login: 'usuario.loja',
    role: UserRole.STORE_USER,
    storeId,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-08-13T12:00:00.000Z'),
    updatedAt: new Date('2026-08-13T12:00:00.000Z'),
    store: {
      id: storeId,
      code: 'LJ001',
      name: 'Loja 01',
      isActive: true,
    },
  };

  const usersServiceMock = {
    findAllStoreUsers: jest.fn(),
    createStoreUser: jest.fn(),
    updateStoreUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate store user listing to the service', async () => {
    usersServiceMock.findAllStoreUsers.mockResolvedValue([storeUserResponse]);

    await expect(controller.findAll()).resolves.toEqual([storeUserResponse]);

    expect(usersServiceMock.findAllStoreUsers).toHaveBeenCalledTimes(1);
  });

  it('should delegate store user creation to the service', async () => {
    const createUserDto = {
      name: 'Usuário da Loja',
      email: 'usuario@validade.local',
      login: 'usuario.loja',
      password: 'senha-segura-123',
      storeId,
    };

    usersServiceMock.createStoreUser.mockResolvedValue(storeUserResponse);

    await expect(controller.create(createUserDto)).resolves.toEqual(
      storeUserResponse,
    );

    expect(usersServiceMock.createStoreUser).toHaveBeenCalledWith(
      createUserDto,
    );
  });

  it('should delegate store user update to the service', async () => {
    const updateUserDto = {
      name: 'Usuário Atualizado',
      isActive: false,
    };

    const updatedUser = {
      ...storeUserResponse,
      name: 'Usuário Atualizado',
      isActive: false,
    };

    usersServiceMock.updateStoreUser.mockResolvedValue(updatedUser);

    await expect(controller.update(userId, updateUserDto)).resolves.toEqual(
      updatedUser,
    );

    expect(usersServiceMock.updateStoreUser).toHaveBeenCalledWith(
      userId,
      updateUserDto,
    );
  });
});
