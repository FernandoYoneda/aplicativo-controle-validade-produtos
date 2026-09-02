import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from '@e965/xlsx';
import {
  ExpirationAlertType,
  ProductLotWriteOffReason,
  UserRole,
} from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ExpirationNotificationsService } from '../notifications/expiration-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExpirationAlertReviewFilter,
  ExpirationAlertStatusFilter,
} from './dto/list-expiration-alerts-query.dto';
import { ExpirationStatusFilter } from './dto/list-expirations-query.dto';
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productLotWriteOff: {
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
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productLotWriteOff: {
      findMany: jest.fn(),
    },
    expirationAlertAcknowledgement: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(executeTransaction),
  };

  const notificationsServiceMock = {
    notifyWriteOff: jest.fn().mockResolvedValue(1),
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
        {
          provide: ExpirationNotificationsService,
          useValue: notificationsServiceMock,
        },
      ],
    }).compile();

    service = module.get<ExpirationsService>(ExpirationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list and summarize active expiration alerts', async () => {
    const expiredAlert = {
      ...expiration,
      expirationDate: new Date('2000-01-01T00:00:00.000Z'),
      alertAcknowledgements: [
        {
          id: '00000000-0000-4000-8000-000000000701',
          alertType: ExpirationAlertType.EXPIRED,
          acknowledgedAt: new Date('2026-09-02T12:00:00.000Z'),
          user: { id: adminUser.id, name: adminUser.name },
        },
      ],
    };
    prismaServiceMock.productLot.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiredAlert]);

    const result = await service.findAlerts(
      {
        page: 1,
        pageSize: 25,
        status: ExpirationAlertStatusFilter.ALL,
        review: ExpirationAlertReviewFilter.ALL,
      },
      adminUser,
    );

    expect(result.summary).toEqual({
      total: 1,
      expired: 1,
      upcoming: 0,
      pending: 0,
      reviewed: 1,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: expirationId,
        alertType: ExpirationAlertType.EXPIRED,
        acknowledgement: expiredAlert.alertAcknowledgements[0],
      }),
    );
  });

  it('should acknowledge the current alert for the authenticated user', async () => {
    const acknowledgement = {
      id: '00000000-0000-4000-8000-000000000701',
      acknowledgedAt: new Date('2026-09-02T12:00:00.000Z'),
      user: { id: storeUser.id, name: storeUser.name },
    };
    prismaServiceMock.productLot.findFirst.mockResolvedValue({
      id: expirationId,
      expirationDate: new Date('2000-01-01T00:00:00.000Z'),
    });
    prismaServiceMock.expirationAlertAcknowledgement.upsert.mockResolvedValue(
      acknowledgement,
    );

    await expect(
      service.acknowledgeAlert(expirationId, storeUser),
    ).resolves.toEqual(acknowledgement);
    expect(
      prismaServiceMock.expirationAlertAcknowledgement.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productLotId_userId_alertType: {
            productLotId: expirationId,
            userId: storeUser.id,
            alertType: ExpirationAlertType.EXPIRED,
          },
        },
      }),
    );
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

  it('should prioritize the earliest lot when searching by barcode', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await expect(
      service.searchWriteOffCandidates(
        { query: '7891234567890', limit: 20 },
        storeUser,
      ),
    ).resolves.toEqual([expiration]);
    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
        take: 20,
      }),
    );
  });

  it('should find write-off candidates by the code embedded in a valid EAN-13', async () => {
    prismaServiceMock.productLot.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([expiration]);

    await expect(
      service.searchWriteOffCandidates(
        { query: '7891033859474', limit: 20 },
        storeUser,
      ),
    ).resolves.toEqual([expiration]);

    expect(prismaServiceMock.productLot.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AND: [
            expect.any(Object),
            {
              storeProduct: {
                product: {
                  code: '85947',
                },
              },
            },
          ],
        },
        orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
        take: 20,
      }),
    );
  });

  it('should register a partial sale and keep the lot active', async () => {
    transactionMock.productLot.findUnique.mockResolvedValue(expiration);
    transactionMock.productLot.update.mockResolvedValue({
      ...expiration,
      quantity: 7,
    });
    const writeOff = {
      id: '00000000-0000-4000-8000-000000000701',
      reason: ProductLotWriteOffReason.SOLD,
      quantity: 3,
      previousQuantity: 10,
      remainingQuantity: 7,
    };
    transactionMock.productLotWriteOff.create.mockResolvedValue(writeOff);

    await expect(
      service.writeOff(
        expirationId,
        { quantity: 3, reason: ProductLotWriteOffReason.SOLD },
        storeUser,
      ),
    ).resolves.toEqual({
      expiration: { ...expiration, quantity: 7 },
      writeOff,
    });
    expect(transactionMock.productLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: 7, isActive: true },
      }),
    );
    expect(transactionMock.productLotWriteOff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // O matcher do Jest é tipado como any; a asserção valida somente o payload observado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          quantity: 3,
          previousQuantity: 10,
          remainingQuantity: 7,
          performedByUserId: storeUser.id,
        }),
      }),
    );
    expect(notificationsServiceMock.notifyWriteOff).toHaveBeenCalledWith(
      writeOff,
    );
  });

  it('should deactivate a lot when the full quantity is written off', async () => {
    transactionMock.productLot.findUnique.mockResolvedValue(expiration);
    transactionMock.productLot.update.mockResolvedValue({
      ...expiration,
      quantity: 0,
      isActive: false,
    });
    transactionMock.productLotWriteOff.create.mockResolvedValue({
      id: 'write-off',
    });

    await service.writeOff(
      expirationId,
      { quantity: 10, reason: ProductLotWriteOffReason.SOLD },
      adminUser,
    );

    expect(transactionMock.productLot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: 0, isActive: false } }),
    );
  });

  it('should keep a completed write-off when its email notification fails', async () => {
    transactionMock.productLot.findUnique.mockResolvedValue(expiration);
    transactionMock.productLot.update.mockResolvedValue({
      ...expiration,
      quantity: 7,
    });
    const writeOff = {
      id: '00000000-0000-4000-8000-000000000702',
      reason: ProductLotWriteOffReason.SOLD,
      quantity: 3,
      previousQuantity: 10,
      remainingQuantity: 7,
    };
    transactionMock.productLotWriteOff.create.mockResolvedValue(writeOff);
    notificationsServiceMock.notifyWriteOff.mockRejectedValueOnce(
      new Error('SMTP indisponível'),
    );

    await expect(
      service.writeOff(
        expirationId,
        { quantity: 3, reason: ProductLotWriteOffReason.SOLD },
        storeUser,
      ),
    ).resolves.toEqual({
      expiration: { ...expiration, quantity: 7 },
      writeOff,
    });
  });

  it('should return a filtered expiration page and global summary', async () => {
    prismaServiceMock.productLot.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await expect(
      service.findPage(
        {
          page: 2,
          pageSize: 1,
          search: '  PROD001  ',
          status: ExpirationStatusFilter.UPCOMING,
          storeId,
        },
        adminUser,
      ),
    ).resolves.toEqual({
      items: [expiration],
      pagination: {
        page: 2,
        pageSize: 1,
        totalItems: 2,
        totalPages: 2,
      },
      summary: {
        totalRecords: 8,
        expiredRecords: 1,
        upcomingRecords: 3,
        threeMonthRecords: 1,
        sixMonthRecords: 0,
        oneYearRecords: 0,
        beyondOneYearRecords: 1,
        inactiveRecords: 2,
      },
    });

    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
      }),
    );
    expect(prismaServiceMock.productLot.count).toHaveBeenNthCalledWith(2, {
      where: {
        storeProduct: {
          storeId,
        },
      },
    });
  });

  it('should keep paginated results restricted to the store user store', async () => {
    prismaServiceMock.productLot.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await service.findPage(
      {
        page: 1,
        pageSize: 25,
        status: ExpirationStatusFilter.ALL,
      },
      storeUser,
    );

    expect(prismaServiceMock.productLot.count).toHaveBeenNthCalledWith(2, {
      where: {
        storeProduct: {
          storeId,
        },
      },
    });
  });

  it('should apply a non-overlapping range between three and six months', async () => {
    prismaServiceMock.productLot.count.mockResolvedValue(0);
    prismaServiceMock.productLot.findMany.mockResolvedValue([]);

    await service.findPage(
      {
        page: 1,
        pageSize: 25,
        status: ExpirationStatusFilter.SIX_MONTHS,
      },
      adminUser,
    );

    expect(prismaServiceMock.productLot.count).toHaveBeenNthCalledWith(1, {
      where: {
        AND: [
          {},
          {
            isActive: true,
            expirationDate: {
              gt: expect.any(Date) as Date,
              lte: expect.any(Date) as Date,
            },
          },
        ],
      },
    });
  });

  it('should return overview indicators restricted to the user store', async () => {
    prismaServiceMock.productLot.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    await expect(service.findOverview(storeUser)).resolves.toEqual({
      summary: {
        totalRecords: 8,
        expiredRecords: 1,
        upcomingRecords: 2,
        threeMonthRecords: 1,
        sixMonthRecords: 1,
        oneYearRecords: 1,
        beyondOneYearRecords: 1,
        inactiveRecords: 1,
      },
      priorityItems: [expiration],
    });

    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { storeProduct: { storeId } },
            expect.objectContaining({ isActive: true }),
          ],
        },
        take: 5,
      }),
    );
  });

  it('should export a filtered spreadsheet restricted to the user store', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);

    const report = await service.exportSpreadsheet(
      {
        search: '  PROD001  ',
        status: ExpirationStatusFilter.ALL,
      },
      storeUser,
    );

    expect(prismaServiceMock.productLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { storeProduct: { storeId } },
            expect.objectContaining({ OR: expect.any(Array) as unknown[] }),
            {},
          ],
        },
        take: 50_001,
      }),
    );
    expect(report.fileName).toMatch(/^validades-\d{8}-\d{6}\.xlsx$/);

    const workbook = XLSX.read(report.buffer, {
      type: 'buffer',
      cellDates: true,
    });
    const worksheet = workbook.Sheets.Validades;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
    });
    const formattedRows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      raw: false,
      dateNF: 'dd/mm/yyyy',
    });

    expect(rows[0]).toEqual([
      'Código do produto',
      'Código de barras',
      'Produto',
      'Loja',
      'Lote',
      'Data de validade',
      'Dias restantes',
      'Situação',
      'Quantidade',
      'Status',
      'Observações',
    ]);
    expect(rows[1]?.slice(0, 5)).toEqual([
      'PROD001',
      '7891234567890',
      'Produto de teste',
      'LJ001 — Loja 01',
      'LOTE-001',
    ]);
    expect(rows[1]?.[8]).toBe(10);
    expect(rows[1]?.[9]).toBe('Ativo');
    expect(formattedRows[1]?.[5]).toBe('31/12/2026');
    expect(worksheet['!autofilter']).toEqual({ ref: 'A1:K2' });
  });

  it('should reject spreadsheet exports above the row limit', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue(
      Array.from({ length: 50_001 }, () => expiration),
    );

    await expect(
      service.exportSpreadsheet(
        { status: ExpirationStatusFilter.ALL },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a paginated query for another store by a store user', async () => {
    await expect(
      service.findPage(
        {
          page: 1,
          pageSize: 25,
          status: ExpirationStatusFilter.ALL,
          storeId: otherStoreId,
        },
        storeUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaServiceMock.productLot.count).not.toHaveBeenCalled();
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
