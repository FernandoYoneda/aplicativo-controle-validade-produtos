import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  type ExpirationRecord,
  ExpirationsService,
} from './expirations.service';

describe('ExpirationsService', () => {
  let service: ExpirationsService;

  const storeId = '00000000-0000-4000-8000-000000000201';
  const otherStoreId = '00000000-0000-4000-8000-000000000202';
  const productId = '00000000-0000-4000-8000-000000000301';
  const storeProductId = '00000000-0000-4000-8000-000000000401';
  const expirationId = '00000000-0000-4000-8000-000000000501';

  const transactionMock = {
    storeProduct: {
      upsert: jest.fn(),
    },
    productLot: {
      create: jest.fn(),
    },
  };

  const executeTransaction = <T>(
    callback: (transaction: typeof transactionMock) => Promise<T>,
  ): Promise<T> => callback(transactionMock);

  const prismaServiceMock = {
    store: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    productLot: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(executeTransaction),
  };

  const adminUser: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000601',
    name: 'Administrador',
    email: 'admin@validade.local',
    login: 'admin',
    role: UserRole.ADMIN,
    storeId: null,
  };

  const storeUser: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000602',
    name: 'Usuário da loja',
    email: 'loja@validade.local',
    login: 'loja',
    role: UserRole.STORE_USER,
    storeId,
  };

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationsService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<ExpirationsService>(ExpirationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list all expiration records for an administrator', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await expect(service.findAll(adminUser)).resolves.toEqual([expiration]);

    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [
          {
            expirationDate: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
      }),
    );
  });

  it('should list only expiration records from the store user store', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await expect(service.findAll(storeUser)).resolves.toEqual([expiration]);

    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          storeProduct: {
            storeId,
          },
        },
      }),
    );
  });

  it('should reject listing for a store user without a store', async () => {
    const storeUserWithoutStore: AuthenticatedUser = {
      ...storeUser,
      storeId: null,
    };

    await expect(service.findAll(storeUserWithoutStore)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prismaServiceMock.productLot.findMany).not.toHaveBeenCalled();
  });

  it('should require a store when an administrator creates a record', async () => {
    await expect(
      service.create(
        {
          productId,
          expirationDate: '2026-12-31',
          quantity: 10,
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaServiceMock.store.findFirst).not.toHaveBeenCalled();
    expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject creation for a missing or inactive store', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          productId,
          storeId,
          expirationDate: '2026-12-31',
          quantity: 10,
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaServiceMock.product.findFirst).not.toHaveBeenCalled();
    expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject creation for a missing or inactive product', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue({
      id: storeId,
    });
    prismaServiceMock.product.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          productId,
          storeId,
          expirationDate: '2026-12-31',
          quantity: 10,
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
  });

  it('should create a record and reuse the store product association', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue({
      id: storeId,
    });
    prismaServiceMock.product.findFirst.mockResolvedValue({
      id: productId,
    });
    transactionMock.storeProduct.upsert.mockResolvedValue({
      id: storeProductId,
    });
    transactionMock.productLot.create.mockResolvedValue(expiration);

    await expect(
      service.create(
        {
          productId,
          storeId,
          batchNumber: expiration.batchNumber,
          expirationDate: '2026-12-31',
          quantity: expiration.quantity,
          notes: expiration.notes,
        },
        adminUser,
      ),
    ).resolves.toEqual(expiration);

    expect(transactionMock.storeProduct.upsert).toHaveBeenCalledWith({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        storeId,
        productId,
      },
      select: {
        id: true,
      },
    });

    expect(transactionMock.productLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          storeProductId,
          batchNumber: expiration.batchNumber,
          expirationDate: new Date('2026-12-31T00:00:00.000Z'),
          quantity: expiration.quantity,
          notes: expiration.notes,
        },
      }),
    );
  });

  it('should use the authenticated store for a store user', async () => {
    prismaServiceMock.store.findFirst.mockResolvedValue({
      id: storeId,
    });
    prismaServiceMock.product.findFirst.mockResolvedValue({
      id: productId,
    });
    transactionMock.storeProduct.upsert.mockResolvedValue({
      id: storeProductId,
    });
    transactionMock.productLot.create.mockResolvedValue(expiration);

    await service.create(
      {
        productId,
        expirationDate: '2026-12-31',
        quantity: 10,
      },
      storeUser,
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

    expect(transactionMock.storeProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
      }),
    );
  });

  it('should reject creation in another store by a store user', async () => {
    await expect(
      service.create(
        {
          productId,
          storeId: otherStoreId,
          expirationDate: '2026-12-31',
          quantity: 10,
        },
        storeUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaServiceMock.store.findFirst).not.toHaveBeenCalled();
    expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject an empty update', async () => {
    await expect(
      service.update(expirationId, {}, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaServiceMock.productLot.findUnique).not.toHaveBeenCalled();
    expect(prismaServiceMock.productLot.update).not.toHaveBeenCalled();
  });

  it('should reject an update when the record does not exist', async () => {
    prismaServiceMock.productLot.findUnique.mockResolvedValue(null);

    await expect(
      service.update(
        expirationId,
        {
          quantity: 20,
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaServiceMock.productLot.update).not.toHaveBeenCalled();
  });

  it('should reject an update from a user of another store', async () => {
    const expirationFromAnotherStore: ExpirationRecord = {
      ...expiration,
      storeProduct: {
        ...expiration.storeProduct,
        store: {
          ...expiration.storeProduct.store,
          id: otherStoreId,
          code: 'LJ002',
          name: 'Loja 02',
        },
      },
    };

    prismaServiceMock.productLot.findUnique.mockResolvedValue(
      expirationFromAnotherStore,
    );

    await expect(
      service.update(
        expirationId,
        {
          quantity: 20,
        },
        storeUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaServiceMock.productLot.update).not.toHaveBeenCalled();
  });

  it('should update and inactivate an expiration record', async () => {
    const updatedExpiration: ExpirationRecord = {
      ...expiration,
      batchNumber: null,
      expirationDate: new Date('2027-01-15T00:00:00.000Z'),
      quantity: 25,
      notes: null,
      isActive: false,
    };

    prismaServiceMock.productLot.findUnique.mockResolvedValue(expiration);
    prismaServiceMock.productLot.update.mockResolvedValue(updatedExpiration);

    await expect(
      service.update(
        expirationId,
        {
          batchNumber: null,
          expirationDate: '2027-01-15',
          quantity: 25,
          notes: null,
          isActive: false,
        },
        storeUser,
      ),
    ).resolves.toEqual(updatedExpiration);

    expect(prismaServiceMock.productLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: expirationId,
        },
        data: {
          batchNumber: null,
          expirationDate: new Date('2027-01-15T00:00:00.000Z'),
          quantity: 25,
          notes: null,
          isActive: false,
        },
      }),
    );
  });
});
