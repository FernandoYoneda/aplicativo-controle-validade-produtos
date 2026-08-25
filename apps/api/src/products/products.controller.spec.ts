import { Test, TestingModule } from '@nestjs/testing';
import type { Product } from '../../generated/prisma/client';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { SearchProductsQueryDto } from './dto/search-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { ProductImportService } from './product-import.service';
import type {
  ProductImportPreview,
  ProductImportResult,
  UploadedProductSpreadsheet,
} from './product-import.types';
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
    findPage: jest.fn(),
    searchActive: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const productImportServiceMock = {
    preview: jest.fn(),
    import: jest.fn(),
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
        {
          provide: ProductImportService,
          useValue: productImportServiceMock,
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

  it('should delegate paginated product listing to the service', async () => {
    const query: ListProductsQueryDto = {
      page: 2,
      pageSize: 25,
      search: 'produto',
    };
    const page = {
      items: [product],
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 30,
        totalPages: 2,
      },
      summary: {
        totalProducts: 40,
        activeProducts: 35,
        inactiveProducts: 5,
      },
    };
    productsServiceMock.findPage.mockResolvedValue(page);

    await expect(controller.findPage(query)).resolves.toEqual(page);
    expect(productsServiceMock.findPage).toHaveBeenCalledWith(query);
  });

  it('should delegate active product search to the service', async () => {
    const query: SearchProductsQueryDto = {
      search: 'produto',
      limit: 20,
    };
    productsServiceMock.searchActive.mockResolvedValue([product]);

    await expect(controller.search(query)).resolves.toEqual([product]);
    expect(productsServiceMock.searchActive).toHaveBeenCalledWith(query);
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

  it('should delegate spreadsheet preview to the import service', async () => {
    const file = {
      buffer: Buffer.from('Quebra 1;Outro\n12345 - Produto;valor'),
      originalname: 'produtos.csv',
      mimetype: 'text/csv',
      size: 44,
    } satisfies UploadedProductSpreadsheet;
    const preview = {
      fileName: file.originalname,
      summary: {
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueProducts: 1,
        excludedProducts: 0,
        conflictingProducts: 0,
        existingProducts: 0,
        importableProducts: 1,
      },
      products: [{ code: '12345', name: 'Produto' }],
      excluded: [],
      issues: [],
      samplesTruncated: false,
    } satisfies ProductImportPreview;
    productImportServiceMock.preview.mockResolvedValue(preview);

    await expect(controller.previewImport(file)).resolves.toEqual(preview);
    expect(productImportServiceMock.preview).toHaveBeenCalledWith(file);
  });

  it('should delegate spreadsheet import to the import service', async () => {
    const file = {
      buffer: Buffer.from('Quebra 1\n12345 - Produto'),
      originalname: 'produtos.csv',
      mimetype: 'text/csv',
      size: 28,
    } satisfies UploadedProductSpreadsheet;
    const result = {
      fileName: file.originalname,
      summary: {
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueProducts: 1,
        excludedProducts: 0,
        conflictingProducts: 0,
        existingProducts: 0,
        importableProducts: 1,
      },
      products: [{ code: '12345', name: 'Produto' }],
      excluded: [],
      issues: [],
      samplesTruncated: false,
      importedProducts: 1,
    } satisfies ProductImportResult;
    productImportServiceMock.import.mockResolvedValue(result);

    await expect(controller.importProducts(file)).resolves.toEqual(result);
    expect(productImportServiceMock.import).toHaveBeenCalledWith(file);
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
