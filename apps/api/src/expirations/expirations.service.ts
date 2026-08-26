import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExpirationDto } from './dto/create-expiration.dto';
import {
  ExpirationStatusFilter,
  type ListExpirationsQueryDto,
} from './dto/list-expirations-query.dto';
import type { UpdateExpirationDto } from './dto/update-expiration.dto';
import type {
  ExpirationOverview,
  ExpirationPage,
  ExpirationSummary,
} from './expiration-page.types';

interface ExpirationDateLimits {
  today: Date;
  upcomingLimit: Date;
  threeMonthLimit: Date;
  sixMonthLimit: Date;
  oneYearLimit: Date;
}

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
  constructor(private readonly prisma: PrismaService) {}

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
    const search = query.search?.trim();
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
          ],
        }
      : undefined;
    const statusWhere = this.getStatusWhere(query.status, dateLimits);
    const where: Prisma.ProductLotWhereInput = {
      AND: [accessWhere, ...(searchWhere ? [searchWhere] : []), statusWhere],
    };

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

      return transaction.productLot.create({
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

    return this.prisma.productLot.update({
      where: {
        id,
      },
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
}
