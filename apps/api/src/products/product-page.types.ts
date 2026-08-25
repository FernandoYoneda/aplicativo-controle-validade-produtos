import type { Product } from '../../generated/prisma/client';

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
