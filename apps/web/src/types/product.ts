export interface Product {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: Product[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
  };
}

export interface CreateProductPayload {
  code: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
}

export interface UpdateProductPayload {
  code?: string;
  barcode?: string | null;
  name?: string;
  brand?: string | null;
  category?: string | null;
  isActive?: boolean;
}

export interface ProductImportItem {
  code: string;
  name: string;
}

export interface ProductImportExcludedItem extends ProductImportItem {
  reason: "Amostra" | "Demonstrador" | "Embalagem ou material operacional";
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
