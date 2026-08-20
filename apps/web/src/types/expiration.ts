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
