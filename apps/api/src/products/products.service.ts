import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Product } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { SearchProductsQueryDto } from './dto/search-products-query.dto';
import { extractEmbeddedProductCodeFromEan13 } from './product-code-matching';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductPage } from './product-page.types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findPage(query: ListProductsQueryDto): Promise<ProductPage> {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput | undefined = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { brand: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [totalItems, totalProducts, activeProducts] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.count(),
      this.prisma.product.count({
        where: {
          isActive: true,
        },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const items = await this.prisma.product.findMany({
      where,
      orderBy: {
        code: 'asc',
      },
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
      summary: {
        totalProducts,
        activeProducts,
        inactiveProducts: totalProducts - activeProducts,
      },
    };
  }

  async searchActive(query: SearchProductsQueryDto): Promise<Product[]> {
    const search = query.search.trim();

    if (!search) {
      return [];
    }

    const embeddedProductCode = extractEmbeddedProductCodeFromEan13(search);

    if (embeddedProductCode) {
      const exactMatches = await this.prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ code: search }, { barcode: search }],
        },
        orderBy: {
          code: 'asc',
        },
        take: query.limit,
      });

      if (exactMatches.length > 0) {
        return exactMatches;
      }

      const embeddedCodeMatches = await this.prisma.product.findMany({
        where: {
          isActive: true,
          code: embeddedProductCode,
        },
        orderBy: {
          code: 'asc',
        },
        take: query.limit,
      });

      if (embeddedCodeMatches.length > 0) {
        return embeddedCodeMatches;
      }
    }

    return this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        code: 'asc',
      },
      take: query.limit,
    });
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const productWithSameCode = await this.prisma.product.findUnique({
      where: {
        code: createProductDto.code,
      },
    });

    if (productWithSameCode) {
      throw new ConflictException('Já existe um produto com este código.');
    }

    if (createProductDto.barcode) {
      const productWithSameBarcode = await this.prisma.product.findUnique({
        where: {
          barcode: createProductDto.barcode,
        },
      });

      if (productWithSameBarcode) {
        throw new ConflictException(
          'Já existe um produto com este código de barras.',
        );
      }
    }

    return this.prisma.product.create({
      data: {
        code: createProductDto.code,
        barcode: createProductDto.barcode ?? null,
        name: createProductDto.name,
        brand: createProductDto.brand ?? null,
        category: createProductDto.category ?? null,
      },
    });
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const hasChanges =
      updateProductDto.code !== undefined ||
      updateProductDto.barcode !== undefined ||
      updateProductDto.name !== undefined ||
      updateProductDto.brand !== undefined ||
      updateProductDto.category !== undefined ||
      updateProductDto.isActive !== undefined;

    if (!hasChanges) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (
      updateProductDto.code !== undefined &&
      updateProductDto.code !== product.code
    ) {
      const productWithSameCode = await this.prisma.product.findUnique({
        where: {
          code: updateProductDto.code,
        },
      });

      if (productWithSameCode) {
        throw new ConflictException('Já existe um produto com este código.');
      }
    }

    if (
      updateProductDto.barcode !== undefined &&
      updateProductDto.barcode !== null &&
      updateProductDto.barcode !== product.barcode
    ) {
      const productWithSameBarcode = await this.prisma.product.findUnique({
        where: {
          barcode: updateProductDto.barcode,
        },
      });

      if (productWithSameBarcode) {
        throw new ConflictException(
          'Já existe um produto com este código de barras.',
        );
      }
    }

    return this.prisma.product.update({
      where: {
        id,
      },
      data: {
        code: updateProductDto.code,
        barcode: updateProductDto.barcode,
        name: updateProductDto.name,
        brand: updateProductDto.brand,
        category: updateProductDto.category,
        isActive: updateProductDto.isActive,
      },
    });
  }
}
