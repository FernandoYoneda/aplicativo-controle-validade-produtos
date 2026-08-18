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
