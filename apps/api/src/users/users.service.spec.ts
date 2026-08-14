import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const storeId = '10000000-0000-4000-8000-000000000001';
  const userId = '20000000-0000-4000-8000-000000000001';

  const publicUserSelect = {
    id: true,
    name: true,
    email: true,
    login: true,
    role: true,
    storeId: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    store: {
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    },
  };

  const storeUserResponse = {
    id: userId,
    name: 'Usuário da Loja',
    email: 'usuario@validade.local',
    login: 'usuario.loja',
    role: UserRole.STORE_USER,
    storeId,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-08-12T12:00:00.000Z'),
    updatedAt: new Date('2026-08-12T12:00:00.000Z'),
    store: {
      id: storeId,
      code: 'LJ001',
      name: 'Loja 01',
      isActive: true,
    },
  };

  const prismaServiceMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    store: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find a user by normalized login or email', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await service.findByLoginOrEmail(' ADMIN@VALIDADE.LOCAL ');

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { login: 'admin@validade.local' },
          { email: 'admin@validade.local' },
        ],
      },
    });
  });

  it('should find only an active user by id', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await service.findActiveById('user-id');

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        isActive: true,
      },
    });
  });

  it('should update the last login date', async () => {
    const currentDate = new Date('2026-08-10T12:00:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(currentDate);
    prismaServiceMock.user.update.mockResolvedValue({});

    try {
      await service.updateLastLoginAt('user-id');

      expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          lastLoginAt: currentDate,
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('should list only store users without password hashes', async () => {
    prismaServiceMock.user.findMany.mockResolvedValue([storeUserResponse]);

    await expect(service.findAllStoreUsers()).resolves.toEqual([
      storeUserResponse,
    ]);

    expect(prismaServiceMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.STORE_USER,
      },
      orderBy: [{ storeId: 'asc' }, { name: 'asc' }],
      select: publicUserSelect,
    });

    expect(publicUserSelect).not.toHaveProperty('passwordHash');
  });

  it('should create a store user with an Argon2id password', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue({ id: storeId });
    prismaServiceMock.user.findFirst.mockResolvedValue(null);
    prismaServiceMock.user.create.mockResolvedValue(storeUserResponse);

    const createUserDto = {
      name: 'Usuário da Loja',
      email: 'usuario@validade.local',
      login: 'usuario.loja',
      password: 'senha-segura-123',
      storeId,
    };

    await expect(service.createStoreUser(createUserDto)).resolves.toEqual(
      storeUserResponse,
    );

    expect(prismaServiceMock.store.findFirst).toHaveBeenCalledWith({
      where: {
        id: storeId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'usuario@validade.local' }, { login: 'usuario.loja' }],
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Usuário da Loja',
        email: 'usuario@validade.local',
        login: 'usuario.loja',
        passwordHash: expect.stringMatching(/^\$argon2id\$/) as unknown,
        role: UserRole.STORE_USER,
        storeId,
      },
      select: publicUserSelect,
    });
  });

  it('should reject creation for a missing or inactive store', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue(null);

    await expect(
      service.createStoreUser({
        name: 'Usuário da Loja',
        email: 'usuario@validade.local',
        login: 'usuario.loja',
        password: 'senha-segura-123',
        storeId,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaServiceMock.user.create).not.toHaveBeenCalled();
  });

  it('should reject creation with duplicated credentials', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue({ id: storeId });
    prismaServiceMock.user.findFirst.mockResolvedValue({
      id: 'duplicated-user-id',
    });

    await expect(
      service.createStoreUser({
        name: 'Usuário da Loja',
        email: 'usuario@validade.local',
        login: 'usuario.loja',
        password: 'senha-segura-123',
        storeId,
      }),
    ).rejects.toThrow(ConflictException);

    expect(prismaServiceMock.user.create).not.toHaveBeenCalled();
  });

  it('should reject an empty update', async () => {
    await expect(service.updateStoreUser(userId, {})).rejects.toThrow(
      BadRequestException,
    );

    expect(prismaServiceMock.user.findFirst).not.toHaveBeenCalled();
    expect(prismaServiceMock.user.update).not.toHaveBeenCalled();
  });

  it('should reject an update when the store user does not exist', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStoreUser(userId, {
        name: 'Novo Nome',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: userId,
        role: UserRole.STORE_USER,
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.update).not.toHaveBeenCalled();
  });

  it('should reject an update with duplicated credentials', async () => {
    prismaServiceMock.user.findFirst
      .mockResolvedValueOnce({ id: userId })
      .mockResolvedValueOnce({ id: 'duplicated-user-id' });

    await expect(
      service.updateStoreUser(userId, {
        email: 'duplicado@validade.local',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prismaServiceMock.user.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: userId,
        role: UserRole.STORE_USER,
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          not: userId,
        },
        OR: [{ email: 'duplicado@validade.local' }],
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.update).not.toHaveBeenCalled();
  });

  it('should update and inactivate a store user', async () => {
    const updatedUser = {
      ...storeUserResponse,
      name: 'Usuário Atualizado',
      isActive: false,
    };

    prismaServiceMock.user.findFirst.mockResolvedValue({ id: userId });
    prismaServiceMock.user.update.mockResolvedValue(updatedUser);

    await expect(
      service.updateStoreUser(userId, {
        name: 'Usuário Atualizado',
        isActive: false,
      }),
    ).resolves.toEqual(updatedUser);

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: userId,
        role: UserRole.STORE_USER,
      },
      select: {
        id: true,
      },
    });

    expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        name: 'Usuário Atualizado',
        isActive: false,
      },
      select: publicUserSelect,
    });
  });
});
