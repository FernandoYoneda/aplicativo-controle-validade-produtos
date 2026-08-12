import { Test, TestingModule } from '@nestjs/testing';
import type { Store } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  let service: StoresService;

  const prismaServiceMock = {
    store: {
      findMany: jest.fn(),
    },
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
    const stores: Store[] = [
      {
        id: 'store-id-1',
        code: 'LJ001',
        name: 'Loja 01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'store-id-2',
        code: 'LJ002',
        name: 'Loja 02',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaServiceMock.store.findMany.mockResolvedValue(stores);

    await expect(service.findAll()).resolves.toEqual(stores);

    expect(prismaServiceMock.store.findMany).toHaveBeenCalledWith({
      orderBy: {
        code: 'asc',
      },
    });
  });
});
