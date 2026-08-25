export interface UploadedProductSpreadsheet {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export type ProductImportExclusionReason =
  'Amostra' | 'Demonstrador' | 'Embalagem ou material operacional';

export interface ProductImportItem {
  code: string;
  name: string;
}

export interface ProductImportExcludedItem extends ProductImportItem {
  reason: ProductImportExclusionReason;
}

export interface ProductImportIssue {
  row: number;
  value: string;
  message: string;
}

export interface ProductImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  uniqueProducts: number;
  excludedProducts: number;
  conflictingProducts: number;
  existingProducts: number;
  importableProducts: number;
}

export interface ProductImportPreview {
  fileName: string;
  summary: ProductImportSummary;
  products: ProductImportItem[];
  excluded: ProductImportExcludedItem[];
  issues: ProductImportIssue[];
  samplesTruncated: boolean;
}

export interface ProductImportResult extends ProductImportPreview {
  importedProducts: number;
}
