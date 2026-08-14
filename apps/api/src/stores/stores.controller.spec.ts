import { Test, TestingModule } from '@nestjs/testing';
import type { Store } from '../../generated/prisma/client';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

describe('StoresController', () => {
  let controller: StoresController;

  const storesServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const store: Store = {
    id: '00000000-0000-4000-8000-000000000019',
    code: 'LJ019',
    name: 'Loja 19',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    storesServiceMock.findAll.mockResolvedValue([store]);

    await expect(controller.findAll()).resolves.toEqual([store]);

    expect(storesServiceMock.findAll).toHaveBeenCalledTimes(1);
  });

  it('should delegate store creation to the service', async () => {
    const createStoreDto = {
      code: 'LJ019',
      name: 'Loja 19',
    };

    storesServiceMock.create.mockResolvedValue(store);

    await expect(controller.create(createStoreDto)).resolves.toEqual(store);

    expect(storesServiceMock.create).toHaveBeenCalledWith(createStoreDto);
  });

  it('should delegate store update to the service', async () => {
    const updateStoreDto = {
      name: 'Loja 19 atualizada',
      isActive: false,
    };

    const updatedStore: Store = {
      ...store,
      name: updateStoreDto.name,
      isActive: updateStoreDto.isActive,
    };

    storesServiceMock.update.mockResolvedValue(updatedStore);

    await expect(controller.update(store.id, updateStoreDto)).resolves.toEqual(
      updatedStore,
    );

    expect(storesServiceMock.update).toHaveBeenCalledWith(
      store.id,
      updateStoreDto,
    );
  });
});
