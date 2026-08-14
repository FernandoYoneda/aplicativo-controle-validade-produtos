import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Store } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  let service: StoresService;

  const prismaServiceMock = {
    store: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const existingStore: Store = {
    id: 'store-id-1',
    code: 'LJ001',
    name: 'Loja 01',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list stores ordered by code', async () => {
    prismaServiceMock.store.findMany.mockResolvedValue([existingStore]);

    await expect(service.findAll()).resolves.toEqual([existingStore]);

    expect(prismaServiceMock.store.findMany).toHaveBeenCalledWith({
      orderBy: {
        code: 'asc',
      },
    });
  });

  it('should create a store when the code is available', async () => {
    const createdStore: Store = {
      ...existingStore,
      id: 'store-id-19',
      code: 'LJ019',
      name: 'Loja 19',
    };

    prismaServiceMock.store.findUnique.mockResolvedValue(null);
    prismaServiceMock.store.create.mockResolvedValue(createdStore);

    await expect(
      service.create({
        code: 'LJ019',
        name: 'Loja 19',
      }),
    ).resolves.toEqual(createdStore);

    expect(prismaServiceMock.store.findUnique).toHaveBeenCalledWith({
      where: {
        code: 'LJ019',
      },
    });

    expect(prismaServiceMock.store.create).toHaveBeenCalledWith({
      data: {
        code: 'LJ019',
        name: 'Loja 19',
      },
    });
  });

  it('should reject creation with a duplicated code', async () => {
    prismaServiceMock.store.findUnique.mockResolvedValue(existingStore);

    await expect(
      service.create({
        code: 'LJ001',
        name: 'Outra loja',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.store.create).not.toHaveBeenCalled();
  });

  it('should reject an empty update', async () => {
    await expect(service.update('store-id-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaServiceMock.store.findUnique).not.toHaveBeenCalled();
    expect(prismaServiceMock.store.update).not.toHaveBeenCalled();
  });

  it('should reject an update when the store does not exist', async () => {
    prismaServiceMock.store.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing-store-id', {
        name: 'Loja inexistente',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaServiceMock.store.update).not.toHaveBeenCalled();
  });

  it('should reject an update with a duplicated code', async () => {
    const storeWithSameCode: Store = {
      ...existingStore,
      id: 'store-id-2',
      code: 'LJ002',
      name: 'Loja 02',
    };

    prismaServiceMock.store.findUnique
      .mockResolvedValueOnce(existingStore)
      .mockResolvedValueOnce(storeWithSameCode);

    await expect(
      service.update('store-id-1', {
        code: 'LJ002',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.store.update).not.toHaveBeenCalled();
  });

  it('should update a store', async () => {
    const updatedStore: Store = {
      ...existingStore,
      name: 'Loja atualizada',
      isActive: false,
    };

    prismaServiceMock.store.findUnique.mockResolvedValue(existingStore);
    prismaServiceMock.store.update.mockResolvedValue(updatedStore);

    await expect(
      service.update('store-id-1', {
        name: 'Loja atualizada',
        isActive: false,
      }),
    ).resolves.toEqual(updatedStore);

    expect(prismaServiceMock.store.update).toHaveBeenCalledWith({
      where: {
        id: 'store-id-1',
      },
      data: {
        code: undefined,
        name: 'Loja atualizada',
        isActive: false,
      },
    });
  });
});
