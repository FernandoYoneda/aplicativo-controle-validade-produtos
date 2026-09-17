import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from '@e965/xlsx';
import type { Prisma } from '../../generated/prisma/client';
import {
  ExpirationAlertType,
  ProductLotStockAdjustmentType,
  ProductLotWriteOffReason,
  UserRole,
} from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { ExpirationNotificationsService } from '../notifications/expiration-notifications.service';
import { extractEmbeddedProductCodeFromEan13 } from '../products/product-code-matching';
import type { CreateExpirationDto } from './dto/create-expiration.dto';
import type { CreateWriteOffDto } from './dto/create-write-off.dto';
import type { CreateWriteOffReversalDto } from './dto/create-write-off-reversal.dto';
import {
  InventoryMovementTypeFilter,
  type ListInventoryMovementsQueryDto,
} from './dto/list-inventory-movements-query.dto';
import {
  ExpirationAlertReviewFilter,
  ExpirationAlertStatusFilter,
  type ListExpirationAlertsQueryDto,
} from './dto/list-expiration-alerts-query.dto';
import {
  ExpirationStatusFilter,
  type FilterExpirationsQueryDto,
  type ListExpirationsQueryDto,
} from './dto/list-expirations-query.dto';
import type { UpdateExpirationDto } from './dto/update-expiration.dto';
import type {
  ListWriteOffsQueryDto,
  SearchWriteOffQueryDto,
} from './dto/search-write-off-query.dto';
import type {
  ExpirationAlertAcknowledgement,
  ExpirationAlertPage,
} from './expiration-alert.types';
import type {
  ExpirationOverview,
  ExpirationPage,
  ExpirationSummary,
} from './expiration-page.types';
import {
  type ExpirationWriteOffRecord,
  type ExpirationWriteOffReversalResult,
  type ExpirationWriteOffResult,
  expirationWriteOffSelect,
  expirationWriteOffReversalSelect,
} from './expiration-write-off.types';
import {
  productLotStockAdjustmentSelect,
  type InventoryMovementPage,
  type InventoryMovementRecord,
  type InventoryMovementSummary,
} from './inventory-movement.types';

interface ExpirationDateLimits {
  today: Date;
  upcomingLimit: Date;
  threeMonthLimit: Date;
  sixMonthLimit: Date;
  oneYearLimit: Date;
}

export interface ExpirationExport {
  buffer: Buffer;
  fileName: string;
}

const MAX_EXPORT_ROWS = 50_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const expirationSelect = {
  id: true,
  batchNumber: true,
  expirationDate: true,
  quantity: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  storeProduct: {
    select: {
      id: true,
      isActive: true,
      store: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
      product: {
        select: {
          id: true,
          code: true,
          barcode: true,
          name: true,
          brand: true,
          category: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.ProductLotSelect;

export type ExpirationRecord = Prisma.ProductLotGetPayload<{
  select: typeof expirationSelect;
}>;

@Injectable()
export class ExpirationsService {
  private readonly logger = new Logger(ExpirationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: ExpirationNotificationsService,
  ) {}

  async findAll(user: AuthenticatedUser): Promise<ExpirationRecord[]> {
    const where: Prisma.ProductLotWhereInput =
      user.role === UserRole.ADMIN
        ? {}
        : {
            storeProduct: {
              storeId: this.requireStoreUserStoreId(user),
            },
          };

    return this.prisma.productLot.findMany({
      where,
      select: expirationSelect,
      orderBy: [
        {
          expirationDate: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async findPage(
    query: ListExpirationsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationPage> {
    const accessWhere = this.getAccessWhere(user, query.storeId);
    const dateLimits = this.getExpirationDateLimits();
    const where = this.getFilteredWhere(query, accessWhere, dateLimits);

    const [totalItems, summary] = await Promise.all([
      this.prisma.productLot.count({ where }),
      this.getExpirationSummary(accessWhere, dateLimits),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const items = await this.prisma.productLot.findMany({
      where,
      select: expirationSelect,
      orderBy: [
        {
          expirationDate: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items,
      pagination: {
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
      summary,
    };
  }

  async findOverview(user: AuthenticatedUser): Promise<ExpirationOverview> {
    const accessWhere = this.getAccessWhere(user);
    const dateLimits = this.getExpirationDateLimits();
    const [summary, priorityItems] = await Promise.all([
      this.getExpirationSummary(accessWhere, dateLimits),
      this.prisma.productLot.findMany({
        where: {
          AND: [
            accessWhere,
            {
              isActive: true,
              expirationDate: { lte: dateLimits.upcomingLimit },
            },
          ],
        },
        select: expirationSelect,
        orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
        take: 5,
      }),
    ]);

    return { summary, priorityItems };
  }

  async findAlerts(
    query: ListExpirationAlertsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationAlertPage> {
    const accessWhere = this.getAccessWhere(user, query.storeId);
    const dateLimits = this.getExpirationDateLimits();
    const baseWhere = this.getAlertBaseWhere(
      query.search,
      accessWhere,
      dateLimits,
    );
    const statusWhere = this.getAlertStatusWhere(query.status, dateLimits);
    const reviewWhere = this.getAlertReviewWhere(query.review, dateLimits);
    const where: Prisma.ProductLotWhereInput = {
      AND: [baseWhere, statusWhere, reviewWhere],
    };
    const [totalItems, expired, upcoming, pending, reviewed] =
      await Promise.all([
        this.prisma.productLot.count({ where }),
        this.prisma.productLot.count({
          where: {
            AND: [
              baseWhere,
              this.getAlertStatusWhere(
                ExpirationAlertStatusFilter.EXPIRED,
                dateLimits,
              ),
            ],
          },
        }),
        this.prisma.productLot.count({
          where: {
            AND: [
              baseWhere,
              this.getAlertStatusWhere(
                ExpirationAlertStatusFilter.UPCOMING,
                dateLimits,
              ),
            ],
          },
        }),
        this.prisma.productLot.count({
          where: {
            AND: [
              baseWhere,
              this.getAlertReviewWhere(
                ExpirationAlertReviewFilter.PENDING,
                dateLimits,
              ),
            ],
          },
        }),
        this.prisma.productLot.count({
          where: {
            AND: [
              baseWhere,
              this.getAlertReviewWhere(
                ExpirationAlertReviewFilter.REVIEWED,
                dateLimits,
              ),
            ],
          },
        }),
      ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const records = await this.prisma.productLot.findMany({
      where,
      select: {
        ...expirationSelect,
        alertAcknowledgements: {
          select: {
            id: true,
            alertType: true,
            acknowledgedAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { acknowledgedAt: 'desc' },
        },
      },
      orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const items = records.map((record) => {
      const { alertAcknowledgements, ...expiration } = record;
      const alertType =
        record.expirationDate < dateLimits.today
          ? ExpirationAlertType.EXPIRED
          : ExpirationAlertType.UPCOMING;
      const acknowledgement =
        alertAcknowledgements.find((item) => item.alertType === alertType) ??
        null;

      return { ...expiration, alertType, acknowledgement };
    });
    return {
      items,
      pagination: {
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
      summary: {
        total: expired + upcoming,
        expired,
        upcoming,
        pending,
        reviewed,
      },
    };
  }

  async acknowledgeAlert(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ExpirationAlertAcknowledgement> {
    const dateLimits = this.getExpirationDateLimits();
    const expiration = await this.prisma.productLot.findFirst({
      where: {
        AND: [
          { id },
          this.getAccessWhere(user),
          {
            isActive: true,
            quantity: { gt: 0 },
            expirationDate: { lte: dateLimits.upcomingLimit },
          },
        ],
      },
      select: { id: true, expirationDate: true },
    });

    if (!expiration) {
      throw new NotFoundException(
        'Alerta de validade não encontrado ou não está mais ativo.',
      );
    }

    const alertType =
      expiration.expirationDate < dateLimits.today
        ? ExpirationAlertType.EXPIRED
        : ExpirationAlertType.UPCOMING;

    return this.prisma.expirationAlertAcknowledgement.upsert({
      where: {
        productLotId_userId_alertType: {
          productLotId: expiration.id,
          userId: user.id,
          alertType,
        },
      },
      create: {
        productLotId: expiration.id,
        userId: user.id,
        alertType,
      },
      update: { acknowledgedAt: new Date() },
      select: {
        id: true,
        acknowledgedAt: true,
        user: { select: { id: true, name: true } },
      },
    });
  }

  async exportSpreadsheet(
    query: FilterExpirationsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationExport> {
    const accessWhere = this.getAccessWhere(user, query.storeId);
    const dateLimits = this.getExpirationDateLimits();
    const where = this.getFilteredWhere(query, accessWhere, dateLimits);
    const expirations = await this.prisma.productLot.findMany({
      where,
      select: expirationSelect,
      orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
      take: MAX_EXPORT_ROWS + 1,
    });

    if (expirations.length > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `A exportação está limitada a ${MAX_EXPORT_ROWS.toLocaleString('pt-BR')} registros. Refine os filtros e tente novamente.`,
      );
    }

    const rows: Array<Array<string | number | Date>> = [
      [
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
      ],
      ...expirations.map((expiration) => {
        const product = expiration.storeProduct.product;
        const store = expiration.storeProduct.store;
        const daysUntilExpiration = Math.round(
          (expiration.expirationDate.getTime() - dateLimits.today.getTime()) /
            MILLISECONDS_PER_DAY,
        );

        return [
          product.code,
          product.barcode ?? '',
          product.name,
          `${store.code} — ${store.name}`,
          expiration.batchNumber ?? '',
          this.getSpreadsheetDate(expiration.expirationDate),
          daysUntilExpiration,
          this.getStatusLabel(expiration, daysUntilExpiration),
          expiration.quantity,
          expiration.isActive ? 'Ativo' : 'Inativo',
          expiration.notes ?? '',
        ];
      }),
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows, {
      cellDates: true,
      dateNF: 'dd/mm/yyyy',
    });
    worksheet['!autofilter'] = { ref: worksheet['!ref'] ?? 'A1:K1' };
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 42 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 12 },
      { wch: 12 },
      { wch: 42 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validades');

    return {
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        cellDates: true,
      }) as Buffer,
      fileName: `validades-${this.getSaoPauloDateStamp()}.xlsx`,
    };
  }

  async findInventoryMovements(
    query: ListInventoryMovementsQueryDto,
    user: AuthenticatedUser,
  ): Promise<InventoryMovementPage> {
    const movements = await this.getInventoryMovements(query, user);
    const total = movements.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const offset = (page - 1) * query.pageSize;

    return {
      data: movements.slice(offset, offset + query.pageSize),
      meta: {
        page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      summary: this.getInventoryMovementSummary(movements),
    };
  }

  async exportInventoryMovements(
    query: ListInventoryMovementsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationExport> {
    const movements = await this.getInventoryMovements(query, user);

    if (movements.length > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `A exportação está limitada a ${MAX_EXPORT_ROWS.toLocaleString('pt-BR')} movimentações. Refine os filtros e tente novamente.`,
      );
    }

    const rows: Array<Array<string | number | Date>> = [
      [
        'Data e hora',
        'Movimentação',
        'Código do produto',
        'Código de barras',
        'Produto',
        'Loja',
        'Lote',
        'Validade',
        'Quantidade',
        'Saldo anterior',
        'Saldo resultante',
        'Motivo',
        'Responsável',
        'E-mail do responsável',
        'Observações',
      ],
      ...movements.map((movement) => {
        const product = movement.productLot.storeProduct.product;
        const store = movement.productLot.storeProduct.store;

        return [
          this.getSaoPauloDateTimeLabel(movement.createdAt),
          this.getInventoryMovementTypeLabel(movement),
          product.code,
          product.barcode ?? '',
          product.name,
          `${store.code} — ${store.name}`,
          movement.productLot.batchNumber ?? '',
          this.getDateOnlyLabel(movement.productLot.expirationDate),
          movement.resultingQuantity - movement.previousQuantity,
          movement.previousQuantity,
          movement.resultingQuantity,
          this.getInventoryMovementReasonLabel(movement),
          movement.performedBy.name,
          movement.performedBy.email,
          movement.notes ?? '',
        ];
      }),
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!autofilter'] = { ref: worksheet['!ref'] ?? 'A1:O1' };
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 42 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 34 },
      { wch: 28 },
      { wch: 32 },
      { wch: 42 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimentações');

    return {
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        cellDates: true,
      }) as Buffer,
      fileName: `movimentacoes-estoque-${this.getSaoPauloDateStamp()}.xlsx`,
    };
  }

  async searchWriteOffCandidates(
    query: SearchWriteOffQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationRecord[]> {
    const accessWhere = this.getAccessWhere(user, query.storeId);
    const availableWhere: Prisma.ProductLotWhereInput = {
      AND: [
        accessWhere,
        {
          isActive: true,
          quantity: { gt: 0 },
          storeProduct: {
            isActive: true,
            store: { isActive: true },
            product: { isActive: true },
          },
        },
      ],
    };
    const orderBy: Prisma.ProductLotOrderByWithRelationInput[] = [
      { expirationDate: 'asc' },
      { createdAt: 'asc' },
    ];
    const exactMatches = await this.prisma.productLot.findMany({
      where: {
        AND: [
          availableWhere,
          {
            storeProduct: {
              product: {
                OR: [{ code: query.query }, { barcode: query.query }],
              },
            },
          },
        ],
      },
      select: expirationSelect,
      orderBy,
      take: query.limit,
    });

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const embeddedProductCode = extractEmbeddedProductCodeFromEan13(
      query.query,
    );

    if (embeddedProductCode) {
      const embeddedCodeMatches = await this.prisma.productLot.findMany({
        where: {
          AND: [
            availableWhere,
            {
              storeProduct: {
                product: {
                  code: embeddedProductCode,
                },
              },
            },
          ],
        },
        select: expirationSelect,
        orderBy,
        take: query.limit,
      });

      if (embeddedCodeMatches.length > 0) {
        return embeddedCodeMatches;
      }
    }

    return this.prisma.productLot.findMany({
      where: {
        AND: [
          availableWhere,
          {
            OR: [
              { batchNumber: { contains: query.query, mode: 'insensitive' } },
              {
                storeProduct: {
                  product: {
                    OR: [
                      { code: { contains: query.query, mode: 'insensitive' } },
                      {
                        barcode: {
                          contains: query.query,
                          mode: 'insensitive',
                        },
                      },
                      { name: { contains: query.query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
      select: expirationSelect,
      orderBy,
      take: query.limit,
    });
  }

  async findWriteOffs(
    query: ListWriteOffsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationWriteOffRecord[]> {
    const accessWhere = this.getAccessWhere(user, query.storeId);

    return this.prisma.productLotWriteOff.findMany({
      where: { productLot: accessWhere },
      select: expirationWriteOffSelect,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  async writeOff(
    id: string,
    dto: CreateWriteOffDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationWriteOffResult> {
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const expiration = await transaction.productLot.findUnique({
          where: { id },
          select: expirationSelect,
        });

        if (!expiration) {
          throw new NotFoundException('Registro de validade não encontrado.');
        }

        this.ensureStoreAccess(user, expiration.storeProduct.store.id);

        if (!expiration.isActive || expiration.quantity <= 0) {
          throw new BadRequestException(
            'Este lote já foi totalmente baixado ou está inativo.',
          );
        }

        if (dto.quantity > expiration.quantity) {
          throw new BadRequestException(
            `A quantidade máxima disponível para baixa é ${expiration.quantity}.`,
          );
        }

        if (
          dto.reason === ProductLotWriteOffReason.EXPIRED &&
          expiration.expirationDate >= this.getExpirationDateLimits().today
        ) {
          throw new BadRequestException(
            'Este lote ainda não venceu. Use o motivo Descartado quando aplicável.',
          );
        }

        const remainingQuantity = expiration.quantity - dto.quantity;
        const updatedExpiration = await transaction.productLot.update({
          where: {
            id,
            quantity: expiration.quantity,
            isActive: true,
          },
          data: {
            quantity: remainingQuantity,
            isActive: remainingQuantity > 0,
          },
          select: expirationSelect,
        });
        const writeOff = await transaction.productLotWriteOff.create({
          data: {
            productLotId: id,
            performedByUserId: user.id,
            reason: dto.reason,
            quantity: dto.quantity,
            previousQuantity: expiration.quantity,
            remainingQuantity,
            notes: dto.notes ?? null,
          },
          select: expirationWriteOffSelect,
        });

        return { expiration: updatedExpiration, writeOff };
      });

      try {
        await this.notifications.notifyWriteOff(result.writeOff);
      } catch (notificationError: unknown) {
        const message =
          notificationError instanceof Error
            ? notificationError.message
            : 'Erro desconhecido';
        this.logger.error(
          `A baixa foi concluída, mas o aviso por e-mail falhou: ${message}`,
        );
      }

      return result;
    } catch (error: unknown) {
      if (this.hasPrismaErrorCode(error, 'P2025')) {
        throw new ConflictException(
          'A quantidade deste lote foi alterada por outra operação. Atualize a busca e tente novamente.',
        );
      }

      throw error;
    }
  }

  async reverseWriteOff(
    id: string,
    dto: CreateWriteOffReversalDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationWriteOffReversalResult> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const writeOff = await transaction.productLotWriteOff.findUnique({
          where: { id },
          select: expirationWriteOffSelect,
        });

        if (!writeOff) {
          throw new NotFoundException('Baixa não encontrada.');
        }

        this.ensureStoreAccess(user, writeOff.productLot.storeProduct.store.id);

        if (writeOff.reversal) {
          throw new ConflictException('Esta baixa já foi estornada.');
        }

        const previousQuantity = writeOff.productLot.quantity;
        const resultingQuantity = previousQuantity + writeOff.quantity;
        const expiration = await transaction.productLot.update({
          where: {
            id: writeOff.productLot.id,
            quantity: previousQuantity,
          },
          data: {
            quantity: resultingQuantity,
            isActive: true,
          },
          select: expirationSelect,
        });
        await transaction.expirationAlertAcknowledgement.deleteMany({
          where: { productLotId: writeOff.productLot.id },
        });
        const reversal = await transaction.productLotWriteOffReversal.create({
          data: {
            writeOffId: writeOff.id,
            reversedByUserId: user.id,
            restoredQuantity: writeOff.quantity,
            previousQuantity,
            resultingQuantity,
            reason: dto.reason,
            notes: dto.notes ?? null,
          },
          select: expirationWriteOffReversalSelect,
        });

        return {
          expiration,
          writeOff: {
            ...writeOff,
            productLot: expiration,
            reversal,
          },
        };
      });
    } catch (error: unknown) {
      if (this.hasPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Esta baixa já foi estornada.');
      }
      if (this.hasPrismaErrorCode(error, 'P2025')) {
        throw new ConflictException(
          'O saldo deste lote foi alterado por outra operação. Atualize o histórico e tente novamente.',
        );
      }
      throw error;
    }
  }

  async create(
    createExpirationDto: CreateExpirationDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationRecord> {
    const storeId = this.resolveStoreId(user, createExpirationDto.storeId);

    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!store) {
      throw new BadRequestException('Loja não encontrada ou inativa.');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: createExpirationDto.productId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new BadRequestException('Produto não encontrado ou inativo.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const storeProduct = await transaction.storeProduct.upsert({
        where: {
          storeId_productId: {
            storeId,
            productId: product.id,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          storeId,
          productId: product.id,
        },
        select: {
          id: true,
        },
      });

      const productLot = await transaction.productLot.create({
        data: {
          storeProductId: storeProduct.id,
          batchNumber: createExpirationDto.batchNumber ?? null,
          expirationDate: this.parseDateOnly(
            createExpirationDto.expirationDate,
          ),
          quantity: createExpirationDto.quantity,
          notes: createExpirationDto.notes ?? null,
        },
        select: expirationSelect,
      });

      await transaction.productLotStockAdjustment.create({
        data: {
          productLotId: productLot.id,
          performedByUserId: user.id,
          type: ProductLotStockAdjustmentType.ENTRY,
          quantityDelta: productLot.quantity,
          previousQuantity: 0,
          resultingQuantity: productLot.quantity,
          reason: 'Cadastro inicial do lote',
        },
        select: { id: true },
      });

      return productLot;
    });
  }

  async update(
    id: string,
    updateExpirationDto: UpdateExpirationDto,
    user: AuthenticatedUser,
  ): Promise<ExpirationRecord> {
    const hasChanges =
      updateExpirationDto.batchNumber !== undefined ||
      updateExpirationDto.expirationDate !== undefined ||
      updateExpirationDto.quantity !== undefined ||
      updateExpirationDto.notes !== undefined ||
      updateExpirationDto.isActive !== undefined;

    if (!hasChanges) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    const expiration = await this.prisma.productLot.findUnique({
      where: {
        id,
      },
      select: expirationSelect,
    });

    if (!expiration) {
      throw new NotFoundException('Registro de validade não encontrado.');
    }

    this.ensureStoreAccess(user, expiration.storeProduct.store.id);

    const quantityChanged =
      updateExpirationDto.quantity !== undefined &&
      updateExpirationDto.quantity !== expiration.quantity;
    const adjustmentReason = updateExpirationDto.adjustmentReason;

    if (quantityChanged && !adjustmentReason) {
      throw new BadRequestException(
        'Informe o motivo do ajuste para alterar a quantidade.',
      );
    }
    const validatedAdjustmentReason = adjustmentReason ?? '';

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const updatedExpiration = await transaction.productLot.update({
          where: quantityChanged
            ? { id, quantity: expiration.quantity }
            : { id },
          data: {
            batchNumber: updateExpirationDto.batchNumber,
            expirationDate:
              updateExpirationDto.expirationDate !== undefined
                ? this.parseDateOnly(updateExpirationDto.expirationDate)
                : undefined,
            quantity: updateExpirationDto.quantity,
            notes: updateExpirationDto.notes,
            isActive: updateExpirationDto.isActive,
          },
          select: expirationSelect,
        });

        if (quantityChanged) {
          await transaction.productLotStockAdjustment.create({
            data: {
              productLotId: id,
              performedByUserId: user.id,
              type: ProductLotStockAdjustmentType.ADJUSTMENT,
              quantityDelta: updatedExpiration.quantity - expiration.quantity,
              previousQuantity: expiration.quantity,
              resultingQuantity: updatedExpiration.quantity,
              reason: validatedAdjustmentReason,
              notes: updateExpirationDto.adjustmentNotes ?? null,
            },
            select: { id: true },
          });
        }

        return updatedExpiration;
      });
    } catch (error: unknown) {
      if (this.hasPrismaErrorCode(error, 'P2025')) {
        throw new ConflictException(
          'O saldo deste lote foi alterado por outra operação. Atualize a lista e tente novamente.',
        );
      }

      throw error;
    }
  }

  private resolveStoreId(
    user: AuthenticatedUser,
    requestedStoreId?: string,
  ): string {
    if (user.role === UserRole.ADMIN) {
      if (!requestedStoreId) {
        throw new BadRequestException(
          'Informe a loja responsável pelo registro de validade.',
        );
      }

      return requestedStoreId;
    }

    const storeId = this.requireStoreUserStoreId(user);

    if (requestedStoreId && requestedStoreId !== storeId) {
      throw new ForbiddenException(
        'Você não possui permissão para gerenciar outra loja.',
      );
    }

    return storeId;
  }

  private async getInventoryMovements(
    query: ListInventoryMovementsQueryDto,
    user: AuthenticatedUser,
  ): Promise<InventoryMovementRecord[]> {
    const accessWhere = this.getAccessWhere(user, query.storeId);
    const from = query.from
      ? new Date(`${query.from.slice(0, 10)}T00:00:00-03:00`)
      : null;
    const to = query.to
      ? new Date(`${query.to.slice(0, 10)}T00:00:00-03:00`)
      : null;

    if (from && to && from > to) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    const toExclusive = to
      ? new Date(to.getTime() + MILLISECONDS_PER_DAY)
      : null;
    const dateWhere: Prisma.DateTimeFilter = {
      ...(from ? { gte: from } : {}),
      ...(toExclusive ? { lt: toExclusive } : {}),
    };
    const hasDateFilter = Boolean(from || toExclusive);
    const includeWriteOffs = [
      InventoryMovementTypeFilter.ALL,
      InventoryMovementTypeFilter.WRITE_OFF,
      InventoryMovementTypeFilter.REVERSAL,
    ].includes(query.type);
    const includeStockAdjustments = [
      InventoryMovementTypeFilter.ALL,
      InventoryMovementTypeFilter.ENTRY,
      InventoryMovementTypeFilter.ADJUSTMENT,
    ].includes(query.type);
    const writeOffWhere: Prisma.ProductLotWriteOffWhereInput =
      query.type === InventoryMovementTypeFilter.WRITE_OFF
        ? { createdAt: dateWhere }
        : query.type === InventoryMovementTypeFilter.REVERSAL
          ? { reversal: { is: { createdAt: dateWhere } } }
          : hasDateFilter
            ? {
                OR: [
                  { createdAt: dateWhere },
                  { reversal: { is: { createdAt: dateWhere } } },
                ],
              }
            : {};
    const adjustmentType =
      query.type === InventoryMovementTypeFilter.ENTRY
        ? ProductLotStockAdjustmentType.ENTRY
        : query.type === InventoryMovementTypeFilter.ADJUSTMENT
          ? ProductLotStockAdjustmentType.ADJUSTMENT
          : undefined;
    const stockAdjustmentWhere: Prisma.ProductLotStockAdjustmentWhereInput = {
      AND: [
        { productLot: accessWhere },
        ...(hasDateFilter ? [{ createdAt: dateWhere }] : []),
        ...(adjustmentType ? [{ type: adjustmentType }] : []),
      ],
    };
    const [writeOffs, stockAdjustments] = await Promise.all([
      includeWriteOffs
        ? this.prisma.productLotWriteOff.findMany({
            where: { AND: [{ productLot: accessWhere }, writeOffWhere] },
            select: expirationWriteOffSelect,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      includeStockAdjustments
        ? this.prisma.productLotStockAdjustment.findMany({
            where: stockAdjustmentWhere,
            select: productLotStockAdjustmentSelect,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);
    const movements = writeOffs.flatMap<InventoryMovementRecord>((writeOff) => {
      const records: InventoryMovementRecord[] = [];

      if (query.type !== InventoryMovementTypeFilter.REVERSAL) {
        records.push({
          id: writeOff.id,
          writeOffId: writeOff.id,
          stockAdjustmentId: null,
          type: 'WRITE_OFF',
          quantity: writeOff.quantity,
          previousQuantity: writeOff.previousQuantity,
          resultingQuantity: writeOff.remainingQuantity,
          reason: writeOff.reason,
          notes: writeOff.notes,
          createdAt: writeOff.createdAt,
          performedBy: writeOff.performedBy,
          productLot: writeOff.productLot,
        });
      }

      if (
        query.type !== InventoryMovementTypeFilter.WRITE_OFF &&
        writeOff.reversal
      ) {
        records.push({
          id: writeOff.reversal.id,
          writeOffId: writeOff.id,
          stockAdjustmentId: null,
          type: 'REVERSAL',
          quantity: writeOff.reversal.restoredQuantity,
          previousQuantity: writeOff.reversal.previousQuantity,
          resultingQuantity: writeOff.reversal.resultingQuantity,
          reason: writeOff.reversal.reason,
          notes: writeOff.reversal.notes,
          createdAt: writeOff.reversal.createdAt,
          performedBy: writeOff.reversal.reversedBy,
          productLot: writeOff.productLot,
        });
      }

      return records;
    });
    movements.push(
      ...stockAdjustments.map<InventoryMovementRecord>((adjustment) => ({
        id: adjustment.id,
        writeOffId: null,
        stockAdjustmentId: adjustment.id,
        type:
          adjustment.type === ProductLotStockAdjustmentType.ENTRY
            ? 'ENTRY'
            : 'ADJUSTMENT',
        quantity: Math.abs(adjustment.quantityDelta),
        previousQuantity: adjustment.previousQuantity,
        resultingQuantity: adjustment.resultingQuantity,
        reason: adjustment.reason,
        notes: adjustment.notes,
        createdAt: adjustment.createdAt,
        performedBy: adjustment.performedBy,
        productLot: adjustment.productLot,
      })),
    );
    const search = query.search?.trim().toLocaleLowerCase('pt-BR');

    return movements
      .filter((movement) => {
        if (from && movement.createdAt < from) return false;
        if (toExclusive && movement.createdAt >= toExclusive) return false;
        if (!search) return true;

        const product = movement.productLot.storeProduct.product;
        const store = movement.productLot.storeProduct.store;
        return [
          this.getInventoryMovementTypeLabel(movement),
          movement.reason,
          this.getInventoryMovementReasonLabel(movement),
          movement.notes,
          movement.performedBy.name,
          movement.performedBy.email,
          product.code,
          product.barcode,
          product.name,
          store.code,
          store.name,
          movement.productLot.batchNumber,
        ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(search));
      })
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );
  }

  private getInventoryMovementSummary(
    movements: InventoryMovementRecord[],
  ): InventoryMovementSummary {
    const entries = movements.filter((movement) => movement.type === 'ENTRY');
    const adjustments = movements.filter(
      (movement) => movement.type === 'ADJUSTMENT',
    );
    const writeOffs = movements.filter(
      (movement) => movement.type === 'WRITE_OFF',
    );
    const reversals = movements.filter(
      (movement) => movement.type === 'REVERSAL',
    );
    const inboundQuantity = movements.reduce((total, movement) => {
      const difference = movement.resultingQuantity - movement.previousQuantity;
      return difference > 0 ? total + difference : total;
    }, 0);
    const outboundQuantity = movements.reduce((total, movement) => {
      const difference = movement.resultingQuantity - movement.previousQuantity;
      return difference < 0 ? total + Math.abs(difference) : total;
    }, 0);

    return {
      total: movements.length,
      entries: entries.length,
      adjustments: adjustments.length,
      writeOffs: writeOffs.length,
      reversals: reversals.length,
      inboundQuantity,
      outboundQuantity,
      netQuantity: inboundQuantity - outboundQuantity,
    };
  }

  private getInventoryMovementTypeLabel(
    movement: InventoryMovementRecord,
  ): string {
    const labels: Record<InventoryMovementRecord['type'], string> = {
      ENTRY: 'Entrada',
      ADJUSTMENT: 'Ajuste',
      WRITE_OFF: 'Baixa',
      REVERSAL: 'Estorno',
    };

    return labels[movement.type];
  }

  private getInventoryMovementReasonLabel(
    movement: InventoryMovementRecord,
  ): string {
    if (movement.type !== 'WRITE_OFF') return movement.reason;

    const labels: Record<ProductLotWriteOffReason, string> = {
      [ProductLotWriteOffReason.SOLD]: 'Vendido',
      [ProductLotWriteOffReason.EXPIRED]: 'Vencido',
      [ProductLotWriteOffReason.DISCARDED]: 'Descartado',
    };
    return labels[movement.reason as ProductLotWriteOffReason];
  }

  private getAccessWhere(
    user: AuthenticatedUser,
    requestedStoreId?: string,
  ): Prisma.ProductLotWhereInput {
    if (user.role === UserRole.ADMIN) {
      return requestedStoreId
        ? {
            storeProduct: {
              storeId: requestedStoreId,
            },
          }
        : {};
    }

    const storeId = this.requireStoreUserStoreId(user);

    if (requestedStoreId && requestedStoreId !== storeId) {
      throw new ForbiddenException(
        'Você não possui permissão para consultar outra loja.',
      );
    }

    return {
      storeProduct: {
        storeId,
      },
    };
  }

  private getFilteredWhere(
    query: FilterExpirationsQueryDto,
    accessWhere: Prisma.ProductLotWhereInput,
    dateLimits: ExpirationDateLimits,
  ): Prisma.ProductLotWhereInput {
    const search = query.search?.trim();
    const embeddedProductCode = search
      ? extractEmbeddedProductCodeFromEan13(search)
      : null;
    const searchWhere: Prisma.ProductLotWhereInput | undefined = search
      ? {
          OR: [
            { batchNumber: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            {
              storeProduct: {
                product: {
                  code: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              storeProduct: {
                product: {
                  barcode: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              storeProduct: {
                product: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              storeProduct: {
                store: {
                  code: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              storeProduct: {
                store: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            },
            ...(embeddedProductCode
              ? [
                  {
                    storeProduct: {
                      product: { code: embeddedProductCode },
                    },
                  },
                ]
              : []),
          ],
        }
      : undefined;

    return {
      AND: [
        accessWhere,
        ...(searchWhere ? [searchWhere] : []),
        this.getStatusWhere(query.status, dateLimits),
      ],
    };
  }

  private getAlertBaseWhere(
    searchValue: string | undefined,
    accessWhere: Prisma.ProductLotWhereInput,
    dateLimits: ExpirationDateLimits,
  ): Prisma.ProductLotWhereInput {
    const search = searchValue?.trim();
    const embeddedProductCode = search
      ? extractEmbeddedProductCodeFromEan13(search)
      : null;

    return {
      AND: [
        accessWhere,
        {
          isActive: true,
          quantity: { gt: 0 },
          expirationDate: { lte: dateLimits.upcomingLimit },
        },
        ...(search
          ? [
              {
                OR: [
                  {
                    batchNumber: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    storeProduct: {
                      product: {
                        code: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    storeProduct: {
                      product: {
                        barcode: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    storeProduct: {
                      product: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    storeProduct: {
                      store: {
                        code: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    storeProduct: {
                      store: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  ...(embeddedProductCode
                    ? [
                        {
                          storeProduct: {
                            product: { code: embeddedProductCode },
                          },
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
      ],
    };
  }

  private getAlertStatusWhere(
    status: ExpirationAlertStatusFilter,
    dateLimits: ExpirationDateLimits,
  ): Prisma.ProductLotWhereInput {
    if (status === ExpirationAlertStatusFilter.EXPIRED) {
      return { expirationDate: { lt: dateLimits.today } };
    }

    if (status === ExpirationAlertStatusFilter.UPCOMING) {
      return {
        expirationDate: {
          gte: dateLimits.today,
          lte: dateLimits.upcomingLimit,
        },
      };
    }

    return {};
  }

  private getAlertReviewWhere(
    review: ExpirationAlertReviewFilter,
    dateLimits: ExpirationDateLimits,
  ): Prisma.ProductLotWhereInput {
    if (review === ExpirationAlertReviewFilter.ALL) {
      return {};
    }

    const relationFilter =
      review === ExpirationAlertReviewFilter.REVIEWED ? 'some' : 'none';

    return {
      OR: [
        {
          expirationDate: { lt: dateLimits.today },
          alertAcknowledgements: {
            [relationFilter]: { alertType: ExpirationAlertType.EXPIRED },
          },
        },
        {
          expirationDate: {
            gte: dateLimits.today,
            lte: dateLimits.upcomingLimit,
          },
          alertAcknowledgements: {
            [relationFilter]: { alertType: ExpirationAlertType.UPCOMING },
          },
        },
      ],
    };
  }

  private getStatusWhere(
    status: ExpirationStatusFilter,
    dateLimits: ExpirationDateLimits,
  ): Prisma.ProductLotWhereInput {
    const {
      today,
      upcomingLimit,
      threeMonthLimit,
      sixMonthLimit,
      oneYearLimit,
    } = dateLimits;

    switch (status) {
      case ExpirationStatusFilter.ACTIVE:
        return { isActive: true };
      case ExpirationStatusFilter.EXPIRED:
        return {
          isActive: true,
          expirationDate: { lt: today },
        };
      case ExpirationStatusFilter.UPCOMING:
        return {
          isActive: true,
          expirationDate: { gte: today, lte: upcomingLimit },
        };
      case ExpirationStatusFilter.THREE_MONTHS:
        return {
          isActive: true,
          expirationDate: { gt: upcomingLimit, lte: threeMonthLimit },
        };
      case ExpirationStatusFilter.SIX_MONTHS:
        return {
          isActive: true,
          expirationDate: { gt: threeMonthLimit, lte: sixMonthLimit },
        };
      case ExpirationStatusFilter.ONE_YEAR:
        return {
          isActive: true,
          expirationDate: { gt: sixMonthLimit, lte: oneYearLimit },
        };
      case ExpirationStatusFilter.BEYOND_ONE_YEAR:
        return {
          isActive: true,
          expirationDate: { gt: oneYearLimit },
        };
      case ExpirationStatusFilter.INACTIVE:
        return { isActive: false };
      case ExpirationStatusFilter.ALL:
        return {};
    }
  }

  private getStatusLabel(
    expiration: ExpirationRecord,
    daysUntilExpiration: number,
  ): string {
    if (!expiration.isActive) {
      return 'Inativo';
    }

    if (daysUntilExpiration < 0) {
      return 'Vencido';
    }

    if (daysUntilExpiration <= 30) {
      return 'Próximos 30 dias';
    }

    if (daysUntilExpiration <= 90) {
      return 'De 31 dias a 3 meses';
    }

    if (daysUntilExpiration <= 180) {
      return 'De 3 a 6 meses';
    }

    if (daysUntilExpiration <= 365) {
      return 'De 6 meses a 1 ano';
    }

    return 'Acima de 1 ano';
  }

  private getSpreadsheetDate(expirationDate: Date): Date {
    return new Date(
      expirationDate.getUTCFullYear(),
      expirationDate.getUTCMonth(),
      expirationDate.getUTCDate(),
    );
  }

  private getSaoPauloDateTimeLabel(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '00';

    return `${value('day')}/${value('month')}/${value('year')} ${value('hour')}:${value('minute')}`;
  }

  private getDateOnlyLabel(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getUTCFullYear()}`;
  }

  private getSaoPauloDateStamp(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '00';

    return `${value('year')}${value('month')}${value('day')}-${value('hour')}${value('minute')}${value('second')}`;
  }

  private getExpirationSummary(
    accessWhere: Prisma.ProductLotWhereInput,
    dateLimits: ExpirationDateLimits,
  ): Promise<ExpirationSummary> {
    const statuses = [
      ExpirationStatusFilter.EXPIRED,
      ExpirationStatusFilter.UPCOMING,
      ExpirationStatusFilter.THREE_MONTHS,
      ExpirationStatusFilter.SIX_MONTHS,
      ExpirationStatusFilter.ONE_YEAR,
      ExpirationStatusFilter.BEYOND_ONE_YEAR,
      ExpirationStatusFilter.INACTIVE,
    ];

    return Promise.all([
      this.prisma.productLot.count({ where: accessWhere }),
      ...statuses.map((status) =>
        this.prisma.productLot.count({
          where: {
            AND: [accessWhere, this.getStatusWhere(status, dateLimits)],
          },
        }),
      ),
    ]).then(
      ([
        totalRecords,
        expiredRecords,
        upcomingRecords,
        threeMonthRecords,
        sixMonthRecords,
        oneYearRecords,
        beyondOneYearRecords,
        inactiveRecords,
      ]) => ({
        totalRecords,
        expiredRecords,
        upcomingRecords,
        threeMonthRecords,
        sixMonthRecords,
        oneYearRecords,
        beyondOneYearRecords,
        inactiveRecords,
      }),
    );
  }

  private getExpirationDateLimits(): ExpirationDateLimits {
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const getPart = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(dateParts.find((part) => part.type === type)?.value);
    const today = new Date(
      Date.UTC(getPart('year'), getPart('month') - 1, getPart('day')),
    );
    const upcomingLimit = new Date(today);
    upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 30);
    const threeMonthLimit = new Date(today);
    threeMonthLimit.setUTCDate(threeMonthLimit.getUTCDate() + 90);
    const sixMonthLimit = new Date(today);
    sixMonthLimit.setUTCDate(sixMonthLimit.getUTCDate() + 180);
    const oneYearLimit = new Date(today);
    oneYearLimit.setUTCDate(oneYearLimit.getUTCDate() + 365);

    return {
      today,
      upcomingLimit,
      threeMonthLimit,
      sixMonthLimit,
      oneYearLimit,
    };
  }

  private requireStoreUserStoreId(user: AuthenticatedUser): string {
    if (!user.storeId) {
      throw new ForbiddenException('Usuário não está vinculado a uma loja.');
    }

    return user.storeId;
  }

  private ensureStoreAccess(
    user: AuthenticatedUser,
    expirationStoreId: string,
  ): void {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    const storeId = this.requireStoreUserStoreId(user);

    if (storeId !== expirationStoreId) {
      throw new ForbiddenException(
        'Você não possui permissão para gerenciar este registro.',
      );
    }
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private hasPrismaErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code
    );
  }
}
