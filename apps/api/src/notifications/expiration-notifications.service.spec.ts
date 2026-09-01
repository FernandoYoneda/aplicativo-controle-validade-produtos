import { Test, type TestingModule } from '@nestjs/testing';
import {
  ExpirationEmailDeliveryStatus,
  ExpirationEmailNotificationType,
  ProductLotWriteOffReason,
  UserRole,
} from '../../generated/prisma/enums';
import type { ExpirationWriteOffRecord } from '../expirations/expiration-write-off.types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailGatewayService } from './email-gateway.service';
import { ExpirationNotificationsService } from './expiration-notifications.service';

describe('ExpirationNotificationsService', () => {
  let service: ExpirationNotificationsService;

  const expiration = {
    id: '00000000-0000-4000-8000-000000000501',
    batchNumber: 'LOTE-001',
    expirationDate: new Date('2026-09-10T00:00:00.000Z'),
    quantity: 4,
    storeProduct: {
      store: {
        id: '00000000-0000-4000-8000-000000000201',
        code: 'LJ001',
        name: 'Loja 01',
      },
      product: {
        code: '85947',
        name: 'Produto de teste',
      },
    },
  };

  const prismaServiceMock = {
    productLot: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    expirationEmailDelivery: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const emailGatewayMock = {
    isEnabled: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    emailGatewayMock.isEnabled.mockReturnValue(true);
    prismaServiceMock.expirationEmailDelivery.findUnique.mockResolvedValue(
      null,
    );
    prismaServiceMock.expirationEmailDelivery.create.mockResolvedValue({
      id: 'delivery-id',
    });
    prismaServiceMock.expirationEmailDelivery.update.mockResolvedValue({
      id: 'delivery-id',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationNotificationsService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: EmailGatewayService, useValue: emailGatewayMock },
      ],
    }).compile();

    service = module.get(ExpirationNotificationsService);
  });

  it('should not query the database when email delivery is disabled', async () => {
    emailGatewayMock.isEnabled.mockReturnValue(false);

    await expect(service.sendExpirationAlerts()).resolves.toBe(0);
    expect(prismaServiceMock.productLot.findMany).not.toHaveBeenCalled();
  });

  it('should send a next-30-days alert to administrators and store users', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);
    prismaServiceMock.user.findMany.mockResolvedValue([
      { name: 'Administrador', email: 'admin@empresa.com.br' },
      { name: 'Loja 01', email: 'loja01@empresa.com.br' },
    ]);

    await expect(
      service.sendExpirationAlerts(new Date('2026-08-31T15:00:00.000Z')),
    ).resolves.toBe(2);

    expect(emailGatewayMock.send).toHaveBeenCalledTimes(2);
    expect(
      prismaServiceMock.expirationEmailDelivery.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        // O matcher do Jest é tipado como any; a asserção valida o payload observado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          notificationType:
            ExpirationEmailNotificationType.EXPIRATION_NEXT_30_DAYS,
          productLotId: expiration.id,
        }),
      }),
    );
  });

  it('should not repeat a delivery already sent', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);
    prismaServiceMock.user.findMany.mockResolvedValue([
      { name: 'Administrador', email: 'admin@empresa.com.br' },
    ]);
    prismaServiceMock.expirationEmailDelivery.findUnique.mockResolvedValue({
      id: 'delivery-id',
      status: ExpirationEmailDeliveryStatus.SENT,
    });

    await expect(
      service.sendExpirationAlerts(new Date('2026-08-31T15:00:00.000Z')),
    ).resolves.toBe(0);
    expect(emailGatewayMock.send).not.toHaveBeenCalled();
  });

  it('should notify administrators after a product write-off', async () => {
    prismaServiceMock.user.findMany.mockResolvedValue([
      { name: 'Administrador', email: 'admin@empresa.com.br' },
    ]);
    const writeOff = {
      id: '00000000-0000-4000-8000-000000000701',
      reason: ProductLotWriteOffReason.SOLD,
      quantity: 1,
      previousQuantity: 2,
      remainingQuantity: 1,
      notes: null,
      createdAt: new Date('2026-08-31T15:00:00.000Z'),
      performedBy: {
        id: '00000000-0000-4000-8000-000000000601',
        name: 'Usuária da loja',
        email: 'loja@empresa.com.br',
        role: UserRole.STORE_USER,
      },
      productLot: {
        id: expiration.id,
        batchNumber: expiration.batchNumber,
        expirationDate: expiration.expirationDate,
        quantity: 1,
        isActive: true,
        storeProduct: {
          store: expiration.storeProduct.store,
          product: {
            id: '00000000-0000-4000-8000-000000000301',
            barcode: '7891033859474',
            ...expiration.storeProduct.product,
          },
        },
      },
    } satisfies ExpirationWriteOffRecord;

    await expect(service.notifyWriteOff(writeOff)).resolves.toBe(1);
    expect(emailGatewayMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@empresa.com.br',
        // O matcher do Jest é tipado como any; a asserção valida o assunto observado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        subject: expect.stringContaining('Baixa por vendido'),
      }),
    );
    expect(
      prismaServiceMock.expirationEmailDelivery.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        // O matcher do Jest é tipado como any; a asserção valida o payload observado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          notificationType: ExpirationEmailNotificationType.WRITE_OFF_SOLD,
          writeOffId: writeOff.id,
        }),
      }),
    );
  });

  it('should record a failed delivery so it can be retried later', async () => {
    prismaServiceMock.productLot.findMany.mockResolvedValue([expiration]);
    prismaServiceMock.user.findMany.mockResolvedValue([
      { name: 'Administrador', email: 'admin@empresa.com.br' },
    ]);
    emailGatewayMock.send.mockRejectedValueOnce(new Error('SMTP indisponível'));

    await expect(
      service.sendExpirationAlerts(new Date('2026-08-31T15:00:00.000Z')),
    ).resolves.toBe(0);
    expect(
      prismaServiceMock.expirationEmailDelivery.update,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // O matcher do Jest é tipado como any; a asserção valida o payload observado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          status: ExpirationEmailDeliveryStatus.FAILED,
          errorMessage: 'SMTP indisponível',
        }),
      }),
    );
  });
});
