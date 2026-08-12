import { Test, TestingModule } from '@nestjs/testing';
import type { Store } from '../../generated/prisma/client';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

describe('StoresController', () => {
  let controller: StoresController;

  const storesServiceMock = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoresController],
      providers: [
        {
          provide: StoresService,
          useValue: storesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<StoresController>(StoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate store listing to the service', async () => {
    const stores: Store[] = [
      {
        id: 'store-id-1',
        code: 'LJ001',
        name: 'Loja 01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    storesServiceMock.findAll.mockResolvedValue(stores);

    await expect(controller.findAll()).resolves.toEqual(stores);

    expect(storesServiceMock.findAll).toHaveBeenCalledTimes(1);
  });
});
