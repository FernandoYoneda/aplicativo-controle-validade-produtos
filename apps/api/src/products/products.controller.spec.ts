import { Test, TestingModule } from '@nestjs/testing';
import type { Product } from '../../generated/prisma/client';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

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

  const productsServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate product listing to the service', async () => {
    productsServiceMock.findAll.mockResolvedValue([product]);

    await expect(controller.findAll()).resolves.toEqual([product]);

    expect(productsServiceMock.findAll).toHaveBeenCalledWith();
  });

  it('should delegate product creation to the service', async () => {
    const createProductDto: CreateProductDto = {
      code: product.code,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      category: product.category,
    };

    productsServiceMock.create.mockResolvedValue(product);

    await expect(controller.create(createProductDto)).resolves.toEqual(product);

    expect(productsServiceMock.create).toHaveBeenCalledWith(createProductDto);
  });

  it('should delegate product update to the service', async () => {
    const updateProductDto: UpdateProductDto = {
      name: 'Produto atualizado',
      isActive: false,
    };
    const updatedProduct: Product = {
      ...product,
      name: updateProductDto.name ?? product.name,
      isActive: false,
    };

    productsServiceMock.update.mockResolvedValue(updatedProduct);

    await expect(
      controller.update(product.id, updateProductDto),
    ).resolves.toEqual(updatedProduct);

    expect(productsServiceMock.update).toHaveBeenCalledWith(
      product.id,
      updateProductDto,
    );
  });
});
