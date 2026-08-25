import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from '@e965/xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { ProductImportService } from './product-import.service';
import type { UploadedProductSpreadsheet } from './product-import.types';

function createFile(
  buffer: Buffer,
  originalname: string,
  mimetype = 'application/octet-stream',
): UploadedProductSpreadsheet {
  return {
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
  };
}

function createWorkbookFile(
  rows: string[][],
  bookType: 'xls' | 'xlsx',
): UploadedProductSpreadsheet {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');
  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType,
  }) as Buffer;

  return createFile(buffer, `produtos.${bookType}`);
}

describe('ProductImportService', () => {
  let service: ProductImportService;

  const prismaServiceMock = {
    product: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductImportService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProductImportService>(ProductImportService);
    prismaServiceMock.product.findMany.mockResolvedValue([]);
  });

  it('should parse CSV, remove duplicates and exclude non-products', async () => {
    const csv = [
      'Quebra 1;Estoque',
      '12345 - Produto válido;2',
      '12345 - Produto válido;4',
      '20000 - DEM PERFUME TESTE 4ml;1',
      '30000 - AMOST PERFUME 1ml;1',
      '40000 - SACOLA P INSTITUCIONAL;1',
      '99900001 - PAPEL SEDA;1',
    ].join('\n');

    const preview = await service.preview(
      createFile(Buffer.from(csv, 'utf8'), 'produtos.csv', 'text/csv'),
    );

    expect(preview.summary).toEqual({
      totalRows: 6,
      validRows: 6,
      invalidRows: 0,
      duplicateRows: 1,
      uniqueProducts: 5,
      excludedProducts: 4,
      conflictingProducts: 0,
      existingProducts: 0,
      importableProducts: 1,
    });
    expect(preview.products).toEqual([
      { code: '12345', name: 'Produto válido' },
    ]);
    expect(preview.excluded.map((item) => item.reason)).toEqual([
      'Demonstrador',
      'Amostra',
      'Embalagem ou material operacional',
      'Embalagem ou material operacional',
    ]);
  });

  it.each(['xls', 'xlsx'] as const)(
    'should read the %s spreadsheet format',
    async (bookType) => {
      const preview = await service.preview(
        createWorkbookFile(
          [
            ['Quebra 1', 'Outra coluna'],
            ['54321 - Produto da planilha', 'valor'],
          ],
          bookType,
        ),
      );

      expect(preview.summary.importableProducts).toBe(1);
      expect(preview.products[0]).toEqual({
        code: '54321',
        name: 'Produto da planilha',
      });
    },
  );

  it('should skip products that already exist in the database', async () => {
    prismaServiceMock.product.findMany.mockResolvedValue([{ code: '12345' }]);
    const file = createFile(
      Buffer.from('Quebra 1\n12345 - Produto existente', 'utf8'),
      'produtos.csv',
      'text/csv',
    );

    const preview = await service.preview(file);

    expect(preview.summary.existingProducts).toBe(1);
    expect(preview.summary.importableProducts).toBe(0);
  });

  it('should block conflicting names for the same code', async () => {
    const file = createFile(
      Buffer.from(
        'Quebra 1\n12345 - Primeiro nome\n12345 - Nome diferente',
        'utf8',
      ),
      'produtos.csv',
      'text/csv',
    );

    const preview = await service.preview(file);

    expect(preview.summary.conflictingProducts).toBe(1);
    expect(preview.summary.importableProducts).toBe(0);
    expect(preview.issues[0].message).toContain('nomes diferentes');
  });

  it('should create only importable products', async () => {
    prismaServiceMock.product.createMany.mockResolvedValue({ count: 1 });
    const file = createFile(
      Buffer.from(
        'Quebra 1\n12345 - Produto válido\n40000 - CAIXA PRESENTE P',
        'utf8',
      ),
      'produtos.csv',
      'text/csv',
    );

    const result = await service.import(file);

    expect(prismaServiceMock.product.createMany).toHaveBeenCalledWith({
      data: [{ code: '12345', name: 'Produto válido' }],
      skipDuplicates: true,
    });
    expect(result.importedProducts).toBe(1);
  });

  it('should finish without writing when every item is excluded', async () => {
    const file = createFile(
      Buffer.from('Quebra 1\n40000 - CAIXA PRESENTE P', 'utf8'),
      'produtos.csv',
      'text/csv',
    );

    const result = await service.import(file);

    expect(prismaServiceMock.product.createMany).not.toHaveBeenCalled();
    expect(result.importedProducts).toBe(0);
  });

  it('should reject unsupported files and missing target columns', async () => {
    await expect(
      service.preview(createFile(Buffer.from('test'), 'produtos.txt')),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.preview(
        createFile(Buffer.from('Codigo;Nome\n1;Produto'), 'produtos.csv'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
