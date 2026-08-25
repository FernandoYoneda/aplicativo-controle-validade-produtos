import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Product } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const prismaServiceMock = {
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const product: Product = {
    id: '00000000-0000-4000-8000-000000000101',
    code: 'PROD001',
    barcode: '7891234567890',
    name: 'Produto de teste',
    brand: 'Marca teste',
    category: 'Categoria teste',
    isActive: true,
    createdAt: new Date('2026-08-17T12:00:00.000Z'),
    updatedAt: new Date('2026-08-17T12:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list products ordered by code', async () => {
    prismaServiceMock.product.findMany.mockResolvedValue([product]);

    await expect(service.findAll()).resolves.toEqual([product]);

    expect(prismaServiceMock.product.findMany).toHaveBeenCalledWith({
      orderBy: {
        code: 'asc',
      },
    });
  });

  it('should return a paginated product list and global summary', async () => {
    prismaServiceMock.product.count
      .mockResolvedValueOnce(52)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(55);
    prismaServiceMock.product.findMany.mockResolvedValue([product]);

    await expect(service.findPage({ page: 2, pageSize: 25 })).resolves.toEqual({
      items: [product],
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 52,
        totalPages: 3,
      },
      summary: {
        totalProducts: 60,
        activeProducts: 55,
        inactiveProducts: 5,
      },
    });

    expect(prismaServiceMock.product.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: {
        code: 'asc',
      },
      skip: 25,
      take: 25,
    });
  });

  it('should search products and clamp a page beyond the last page', async () => {
    prismaServiceMock.product.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(55);
    prismaServiceMock.product.findMany.mockResolvedValue([product]);

    const result = await service.findPage({
      page: 8,
      pageSize: 25,
      search: '  produto  ',
    });

    expect(result.pagination.page).toBe(1);
    expect(prismaServiceMock.product.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { code: { contains: 'produto', mode: 'insensitive' } },
          { barcode: { contains: 'produto', mode: 'insensitive' } },
          { name: { contains: 'produto', mode: 'insensitive' } },
          { brand: { contains: 'produto', mode: 'insensitive' } },
          { category: { contains: 'produto', mode: 'insensitive' } },
        ],
      },
    });
    expect(prismaServiceMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
      }),
    );
  });

  it('should create a product when code and barcode are available', async () => {
    prismaServiceMock.product.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaServiceMock.product.create.mockResolvedValue(product);

    await expect(
      service.create({
        code: product.code,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        category: product.category,
      }),
    ).resolves.toEqual(product);

    expect(prismaServiceMock.product.findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        code: product.code,
      },
    });
    expect(prismaServiceMock.product.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        barcode: product.barcode,
      },
    });
    expect(prismaServiceMock.product.create).toHaveBeenCalledWith({
      data: {
        code: product.code,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        category: product.category,
      },
    });
  });

  it('should create a product with null optional fields', async () => {
    const productWithoutOptionalFields: Product = {
      ...product,
      barcode: null,
      brand: null,
      category: null,
    };

    prismaServiceMock.product.findUnique.mockResolvedValue(null);
    prismaServiceMock.product.create.mockResolvedValue(
      productWithoutOptionalFields,
    );

    await service.create({
      code: product.code,
      name: product.name,
    });

    expect(prismaServiceMock.product.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaServiceMock.product.create).toHaveBeenCalledWith({
      data: {
        code: product.code,
        barcode: null,
        name: product.name,
        brand: null,
        category: null,
      },
    });
  });

  it('should reject creation with a duplicated code', async () => {
    prismaServiceMock.product.findUnique.mockResolvedValue(product);

    await expect(
      service.create({
        code: product.code,
        name: product.name,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.product.create).not.toHaveBeenCalled();
  });

  it('should reject creation with a duplicated barcode', async () => {
    prismaServiceMock.product.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(product);

    await expect(
      service.create({
        code: 'PROD002',
        barcode: product.barcode,
        name: 'Outro produto',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.product.create).not.toHaveBeenCalled();
  });

  it('should reject an empty update', async () => {
    await expect(service.update(product.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaServiceMock.product.findUnique).not.toHaveBeenCalled();
    expect(prismaServiceMock.product.update).not.toHaveBeenCalled();
  });

  it('should reject an update when the product does not exist', async () => {
    prismaServiceMock.product.findUnique.mockResolvedValue(null);

    await expect(
      service.update(product.id, {
        name: 'Produto atualizado',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaServiceMock.product.update).not.toHaveBeenCalled();
  });

  it('should reject an update with a duplicated code', async () => {
    prismaServiceMock.product.findUnique
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({
        ...product,
        id: '00000000-0000-4000-8000-000000000102',
        code: 'PROD002',
      });

    await expect(
      service.update(product.id, {
        code: 'PROD002',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.product.update).not.toHaveBeenCalled();
  });

  it('should reject an update with a duplicated barcode', async () => {
    prismaServiceMock.product.findUnique
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({
        ...product,
        id: '00000000-0000-4000-8000-000000000102',
        barcode: '7891234567899',
      });

    await expect(
      service.update(product.id, {
        barcode: '7891234567899',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaServiceMock.product.update).not.toHaveBeenCalled();
  });

  it('should update and inactivate a product', async () => {
    const updatedProduct: Product = {
      ...product,
      barcode: null,
      name: 'Produto atualizado',
      brand: null,
      category: 'Nova categoria',
      isActive: false,
    };

    prismaServiceMock.product.findUnique.mockResolvedValue(product);
    prismaServiceMock.product.update.mockResolvedValue(updatedProduct);

    await expect(
      service.update(product.id, {
        barcode: null,
        name: updatedProduct.name,
        brand: null,
        category: updatedProduct.category,
        isActive: false,
      }),
    ).resolves.toEqual(updatedProduct);

    expect(prismaServiceMock.product.update).toHaveBeenCalledWith({
      where: {
        id: product.id,
      },
      data: {
        code: undefined,
        barcode: null,
        name: updatedProduct.name,
        brand: null,
        category: updatedProduct.category,
        isActive: false,
      },
    });
  });
});
