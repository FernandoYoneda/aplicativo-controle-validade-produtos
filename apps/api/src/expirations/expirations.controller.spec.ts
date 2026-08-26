import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  ExpirationStatusFilter,
  type ListExpirationsQueryDto,
} from './dto/list-expirations-query.dto';
import { ExpirationsController } from './expirations.controller';
import {
  type ExpirationRecord,
  ExpirationsService,
} from './expirations.service';

describe('ExpirationsController', () => {
  let controller: ExpirationsController;

  const storeId = '00000000-0000-4000-8000-000000000201';
  const productId = '00000000-0000-4000-8000-000000000301';
  const storeProductId = '00000000-0000-4000-8000-000000000401';
  const expirationId = '00000000-0000-4000-8000-000000000501';

  const authenticatedUser: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000601',
    name: 'Usuário da loja',
    email: 'loja@validade.local',
    login: 'loja',
    role: UserRole.STORE_USER,
    storeId,
  };

  const request = {
    user: authenticatedUser,
  } as AuthenticatedRequest;

  const expiration: ExpirationRecord = {
    id: expirationId,
    batchNumber: 'LOTE-001',
    expirationDate: new Date('2026-12-31T00:00:00.000Z'),
    quantity: 10,
    notes: 'Registro de teste',
    isActive: true,
    createdAt: new Date('2026-08-17T12:00:00.000Z'),
    updatedAt: new Date('2026-08-17T12:00:00.000Z'),
    storeProduct: {
      id: storeProductId,
      isActive: true,
      store: {
        id: storeId,
        code: 'LJ001',
        name: 'Loja 01',
        isActive: true,
      },
      product: {
        id: productId,
        code: 'PROD001',
        barcode: '7891234567890',
        name: 'Produto de teste',
        brand: 'Marca teste',
        category: 'Categoria teste',
        isActive: true,
      },
    },
  };

  const expirationsServiceMock = {
    findAll: jest.fn(),
    findPage: jest.fn(),
    findOverview: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpirationsController],
      providers: [
        {
          provide: ExpirationsService,
          useValue: expirationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ExpirationsController>(ExpirationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate expiration listing to the service', async () => {
    expirationsServiceMock.findAll.mockResolvedValue([expiration]);

    await expect(controller.findAll(request)).resolves.toEqual([expiration]);

    expect(expirationsServiceMock.findAll).toHaveBeenCalledWith(
      authenticatedUser,
    );
  });

  it('should delegate paginated expiration listing to the service', async () => {
    const query: ListExpirationsQueryDto = {
      page: 2,
      pageSize: 25,
      search: 'produto',
      status: ExpirationStatusFilter.UPCOMING,
      storeId,
    };
    const page = {
      items: [expiration],
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 30,
        totalPages: 2,
      },
      summary: {
        totalRecords: 40,
        expiredRecords: 5,
        upcomingRecords: 10,
        threeMonthRecords: 8,
        sixMonthRecords: 6,
        oneYearRecords: 5,
        beyondOneYearRecords: 4,
        inactiveRecords: 2,
      },
    };
    expirationsServiceMock.findPage.mockResolvedValue(page);

    await expect(controller.findPage(query, request)).resolves.toEqual(page);
    expect(expirationsServiceMock.findPage).toHaveBeenCalledWith(
      query,
      authenticatedUser,
    );
  });

  it('should delegate expiration overview to the service', async () => {
    const overview = {
      summary: {
        totalRecords: 40,
        expiredRecords: 5,
        upcomingRecords: 10,
        threeMonthRecords: 8,
        sixMonthRecords: 6,
        oneYearRecords: 5,
        beyondOneYearRecords: 4,
        inactiveRecords: 2,
      },
      priorityItems: [expiration],
    };
    expirationsServiceMock.findOverview.mockResolvedValue(overview);

    await expect(controller.findOverview(request)).resolves.toEqual(overview);
    expect(expirationsServiceMock.findOverview).toHaveBeenCalledWith(
      authenticatedUser,
    );
  });

  it('should delegate expiration creation to the service', async () => {
    const createExpirationDto = {
      productId,
      storeId,
      batchNumber: 'LOTE-001',
      expirationDate: '2026-12-31',
      quantity: 10,
      notes: 'Registro de teste',
    };

    expirationsServiceMock.create.mockResolvedValue(expiration);

    await expect(
      controller.create(createExpirationDto, request),
    ).resolves.toEqual(expiration);

    expect(expirationsServiceMock.create).toHaveBeenCalledWith(
      createExpirationDto,
      authenticatedUser,
    );
  });

  it('should delegate expiration update to the service', async () => {
    const updateExpirationDto = {
      batchNumber: null,
      expirationDate: '2027-01-15',
      quantity: 25,
      notes: null,
      isActive: false,
    };

    const updatedExpiration: ExpirationRecord = {
      ...expiration,
      batchNumber: null,
      expirationDate: new Date('2027-01-15T00:00:00.000Z'),
      quantity: 25,
      notes: null,
      isActive: false,
    };

    expirationsServiceMock.update.mockResolvedValue(updatedExpiration);

    await expect(
      controller.update(expirationId, updateExpirationDto, request),
    ).resolves.toEqual(updatedExpiration);

    expect(expirationsServiceMock.update).toHaveBeenCalledWith(
      expirationId,
      updateExpirationDto,
      authenticatedUser,
    );
  });
});
