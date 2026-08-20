import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Product } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

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
