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

export type ExpirationAlertType = "UPCOMING" | "EXPIRED";
export type ExpirationAlertStatusFilter = "all" | "expired" | "upcoming";
export type ExpirationAlertReviewFilter = "all" | "pending" | "reviewed";

export interface ExpirationAlertAcknowledgement {
  id: string;
  acknowledgedAt: string;
  user: {
    id: string;
    name: string;
  };
}

export interface ExpirationAlertItem extends ExpirationRecord {
  alertType: ExpirationAlertType;
  acknowledgement: ExpirationAlertAcknowledgement | null;
}

export interface ExpirationAlertPage {
  items: ExpirationAlertItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    total: number;
    expired: number;
    upcoming: number;
    pending: number;
    reviewed: number;
  };
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

export type ExpirationWriteOffReason = "SOLD" | "EXPIRED" | "DISCARDED";

export interface ExpirationWriteOffRecord {
  id: string;
  reason: ExpirationWriteOffReason;
  quantity: number;
  previousQuantity: number;
  remainingQuantity: number;
  notes: string | null;
  createdAt: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "STORE_USER";
  };
  productLot: Pick<
    ExpirationRecord,
    "id" | "batchNumber" | "expirationDate" | "quantity" | "isActive"
  > & {
    storeProduct: Pick<ExpirationStoreProduct, "store" | "product">;
  };
}

export interface CreateWriteOffPayload {
  quantity: number;
  reason: ExpirationWriteOffReason;
  notes?: string;
}

export interface ExpirationWriteOffResult {
  expiration: ExpirationRecord;
  writeOff: ExpirationWriteOffRecord;
}
