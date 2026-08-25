import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from '@e965/xlsx';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ProductImportExcludedItem,
  ProductImportExclusionReason,
  ProductImportIssue,
  ProductImportItem,
  ProductImportPreview,
  ProductImportResult,
  UploadedProductSpreadsheet,
} from './product-import.types';

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_ROWS = 100_000;
const SAMPLE_LIMIT = 50;
const PRODUCT_VALUE_PATTERN = /^\s*(\d+)\s*-\s*(.+?)\s*$/;
const DEMONSTRATOR_PATTERN = /(^|\s)(DEM|DEMONSTRADOR(?:A)?)(\s|$)/i;
const SAMPLE_PATTERN = /(^|\s)AMOST(?:RA)?(\s|$)/i;
const PACKAGING_PATTERN =
  /(^|\s)(SACOLAS?|SACL|SACO\s+PLT|CAIXA|PAPEL\s+(?:DE\s+)?SEDA|KIT\s+TAG|CART(?:AO|ÃO)\s+PRESENTE|CART(?:AO|ÃO|\s+DE)\s+ADESIVOS?|ETIQ(?:UETA)?S?)(\s|$)/i;

interface ParsedSpreadsheet {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  products: ProductImportItem[];
  excluded: ProductImportExcludedItem[];
  conflictCodes: Set<string>;
  issues: ProductImportIssue[];
}

interface ProductImportAnalysis {
  fileName: string;
  parsed: ParsedSpreadsheet;
  importableProducts: ProductImportItem[];
  existingProducts: number;
}

function normalizeHeader(value: unknown): string {
  return spreadsheetCellToString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function spreadsheetCellToString(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return '';
}

function normalizeProductName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getExclusionReason(
  product: ProductImportItem,
): ProductImportExclusionReason | null {
  if (SAMPLE_PATTERN.test(product.name)) {
    return 'Amostra';
  }

  if (DEMONSTRATOR_PATTERN.test(product.name)) {
    return 'Demonstrador';
  }

  if (product.code.startsWith('999') || PACKAGING_PATTERN.test(product.name)) {
    return 'Embalagem ou material operacional';
  }

  return null;
}

@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    file: UploadedProductSpreadsheet | undefined,
  ): Promise<ProductImportPreview> {
    const analysis = await this.analyze(file);

    return this.toPreview(analysis);
  }

  async import(
    file: UploadedProductSpreadsheet | undefined,
  ): Promise<ProductImportResult> {
    const analysis = await this.analyze(file);
    const importedProducts =
      analysis.importableProducts.length === 0
        ? 0
        : (
            await this.prisma.product.createMany({
              data: analysis.importableProducts.map((product) => ({
                code: product.code,
                name: product.name,
              })),
              skipDuplicates: true,
            })
          ).count;

    return {
      ...this.toPreview(analysis),
      importedProducts,
    };
  }

  private async analyze(
    file: UploadedProductSpreadsheet | undefined,
  ): Promise<ProductImportAnalysis> {
    const validatedFile = this.validateFile(file);
    const parsed = this.parseSpreadsheet(validatedFile);
    const candidates = parsed.products.filter(
      (product) => !parsed.conflictCodes.has(product.code),
    );
    const existingProducts = await this.prisma.product.findMany({
      where: {
        code: {
          in: candidates.map((product) => product.code),
        },
      },
      select: {
        code: true,
      },
    });
    const existingCodes = new Set(
      existingProducts.map((product) => product.code),
    );

    return {
      fileName: validatedFile.originalname,
      parsed,
      importableProducts: candidates.filter(
        (product) => !existingCodes.has(product.code),
      ),
      existingProducts: existingCodes.size,
    };
  }

  private toPreview(analysis: ProductImportAnalysis): ProductImportPreview {
    const { fileName, parsed, importableProducts, existingProducts } = analysis;
    const samplesTruncated =
      importableProducts.length > SAMPLE_LIMIT ||
      parsed.excluded.length > SAMPLE_LIMIT ||
      parsed.issues.length > SAMPLE_LIMIT;

    return {
      fileName,
      summary: {
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        duplicateRows: parsed.duplicateRows,
        uniqueProducts: parsed.products.length + parsed.excluded.length,
        excludedProducts: parsed.excluded.length,
        conflictingProducts: parsed.conflictCodes.size,
        existingProducts,
        importableProducts: importableProducts.length,
      },
      products: importableProducts.slice(0, SAMPLE_LIMIT),
      excluded: parsed.excluded.slice(0, SAMPLE_LIMIT),
      issues: parsed.issues.slice(0, SAMPLE_LIMIT),
      samplesTruncated,
    };
  }

  private validateFile(
    file: UploadedProductSpreadsheet | undefined,
  ): UploadedProductSpreadsheet {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Selecione uma planilha para importar.');
    }

    const extension = extname(file.originalname).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        'Formato não suportado. Envie um arquivo XLSX, XLS ou CSV.',
      );
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('O arquivo deve ter no máximo 15 MB.');
    }

    if (
      extension === '.xlsx' &&
      !(file.buffer[0] === 0x50 && file.buffer[1] === 0x4b)
    ) {
      throw new BadRequestException('O conteúdo do arquivo XLSX é inválido.');
    }

    if (
      extension === '.xls' &&
      !(
        file.buffer[0] === 0xd0 &&
        file.buffer[1] === 0xcf &&
        file.buffer[2] === 0x11 &&
        file.buffer[3] === 0xe0
      )
    ) {
      throw new BadRequestException('O conteúdo do arquivo XLS é inválido.');
    }

    return file;
  }

  private parseSpreadsheet(
    file: UploadedProductSpreadsheet,
  ): ParsedSpreadsheet {
    let workbook: XLSX.WorkBook;

    try {
      const extension = extname(file.originalname).toLowerCase();

      if (extension === '.csv') {
        workbook = XLSX.read(this.decodeCsv(file.buffer), {
          type: 'string',
          cellFormula: false,
          cellHTML: false,
          cellStyles: false,
        });
      } else {
        workbook = XLSX.read(file.buffer, {
          type: 'buffer',
          cellFormula: false,
          cellHTML: false,
          cellStyles: false,
          bookVBA: false,
        });
      }
    } catch {
      throw new BadRequestException(
        'Não foi possível ler a planilha. Verifique se o arquivo não está corrompido ou protegido por senha.',
      );
    }

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new BadRequestException('A planilha não possui nenhuma aba.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) {
      throw new BadRequestException('A planilha está vazia.');
    }

    const headerLocation = this.findTargetColumn(rows);

    if (!headerLocation) {
      throw new BadRequestException(
        "A coluna 'Quebra 1' não foi encontrada na planilha.",
      );
    }

    const dataRows = rows.slice(headerLocation.rowIndex + 1);

    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException(
        `A planilha ultrapassa o limite de ${MAX_ROWS.toLocaleString('pt-BR')} linhas.`,
      );
    }

    const uniqueProducts = new Map<string, ProductImportItem>();
    const conflictCodes = new Set<string>();
    const issues: ProductImportIssue[] = [];
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    dataRows.forEach((row, dataIndex) => {
      const rowNumber = headerLocation.rowIndex + dataIndex + 2;
      const rawValue = spreadsheetCellToString(
        row[headerLocation.columnIndex],
      ).trim();
      const match = PRODUCT_VALUE_PATTERN.exec(rawValue);

      if (!match) {
        invalidRows += 1;
        issues.push({
          row: rowNumber,
          value: rawValue,
          message: "Use o formato 'código - nome do produto'.",
        });
        return;
      }

      const code = match[1];
      const name = normalizeProductName(match[2]);

      if (
        code.length < 2 ||
        code.length > 40 ||
        name.length < 2 ||
        name.length > 160
      ) {
        invalidRows += 1;
        issues.push({
          row: rowNumber,
          value: rawValue,
          message: 'O código ou o nome ultrapassa os limites permitidos.',
        });
        return;
      }

      validRows += 1;
      const knownProduct = uniqueProducts.get(code);

      if (knownProduct) {
        duplicateRows += 1;

        if (
          knownProduct.name.localeCompare(name, 'pt-BR', {
            sensitivity: 'base',
          }) !== 0
        ) {
          conflictCodes.add(code);
          issues.push({
            row: rowNumber,
            value: rawValue,
            message: `O código ${code} aparece com nomes diferentes.`,
          });
        }

        return;
      }

      uniqueProducts.set(code, { code, name });
    });

    const products: ProductImportItem[] = [];
    const excluded: ProductImportExcludedItem[] = [];

    for (const product of uniqueProducts.values()) {
      const reason = getExclusionReason(product);

      if (reason) {
        excluded.push({ ...product, reason });
      } else {
        products.push(product);
      }
    }

    return {
      totalRows: dataRows.length,
      validRows,
      invalidRows,
      duplicateRows,
      products,
      excluded,
      conflictCodes,
      issues,
    };
  }

  private findTargetColumn(
    rows: unknown[][],
  ): { rowIndex: number; columnIndex: number } | null {
    const inspectedRows = rows.slice(0, 20);

    for (let rowIndex = 0; rowIndex < inspectedRows.length; rowIndex += 1) {
      const columnIndex = inspectedRows[rowIndex].findIndex((cell) => {
        const normalized = normalizeHeader(cell);

        return normalized === 'quebra1' || normalized === 'quabra1';
      });

      if (columnIndex >= 0) {
        return { rowIndex, columnIndex };
      }
    }

    return null;
  }

  private decodeCsv(buffer: Buffer): string {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder('windows-1252').decode(buffer);
    }
  }
}
