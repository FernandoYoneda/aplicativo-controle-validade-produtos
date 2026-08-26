export interface ExpirationStore {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ExpirationProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  isActive: boolean;
}

export interface ExpirationStoreProduct {
  id: string;
  isActive: boolean;
  store: ExpirationStore;
  product: ExpirationProduct;
}

export interface ExpirationRecord {
  id: string;
  batchNumber: string | null;
  expirationDate: string;
  quantity: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  storeProduct: ExpirationStoreProduct;
}

export type ExpirationStatusFilter =
  | "all"
  | "expired"
  | "upcoming"
  | "threeMonths"
  | "sixMonths"
  | "oneYear"
  | "beyondOneYear"
  | "inactive";

export interface ExpirationSummary {
  totalRecords: number;
  expiredRecords: number;
  upcomingRecords: number;
  threeMonthRecords: number;
  sixMonthRecords: number;
  oneYearRecords: number;
  beyondOneYearRecords: number;
  inactiveRecords: number;
}

export interface ExpirationPage {
  items: ExpirationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: ExpirationSummary;
}

export interface ExpirationOverview {
  summary: ExpirationSummary;
  priorityItems: ExpirationRecord[];
}

export interface CreateExpirationPayload {
  productId: string;
  storeId?: string;
  batchNumber?: string | null;
  expirationDate: string;
  quantity: number;
  notes?: string | null;
}

export interface UpdateExpirationPayload {
  batchNumber?: string | null;
  expirationDate?: string;
  quantity?: number;
  notes?: string | null;
  isActive?: boolean;
}
