import type { Prisma } from '../../generated/prisma/client';
import type { ExpirationWriteOffRecord } from './expiration-write-off.types';

export const productLotStockAdjustmentSelect = {
  id: true,
  type: true,
  quantityDelta: true,
  previousQuantity: true,
  resultingQuantity: true,
  reason: true,
  notes: true,
  createdAt: true,
  performedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  productLot: {
    select: {
      id: true,
      batchNumber: true,
      expirationDate: true,
      quantity: true,
      isActive: true,
      storeProduct: {
        select: {
          store: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          product: {
            select: {
              id: true,
              code: true,
              barcode: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductLotStockAdjustmentSelect;

export type ProductLotStockAdjustmentRecord =
  Prisma.ProductLotStockAdjustmentGetPayload<{
    select: typeof productLotStockAdjustmentSelect;
  }>;

export type InventoryMovementType =
  'ENTRY' | 'ADJUSTMENT' | 'WRITE_OFF' | 'REVERSAL';

type InventoryMovementActor = ExpirationWriteOffRecord['performedBy'];
type InventoryMovementProductLot = ExpirationWriteOffRecord['productLot'];

export interface InventoryMovementRecord {
  id: string;
  writeOffId: string | null;
  stockAdjustmentId: string | null;
  type: InventoryMovementType;
  quantity: number;
  previousQuantity: number;
  resultingQuantity: number;
  reason: string;
  notes: string | null;
  createdAt: Date;
  performedBy: InventoryMovementActor;
  productLot: InventoryMovementProductLot;
}

export interface InventoryMovementSummary {
  total: number;
  entries: number;
  adjustments: number;
  writeOffs: number;
  reversals: number;
  inboundQuantity: number;
  outboundQuantity: number;
  netQuantity: number;
}

export interface InventoryMovementPage {
  data: InventoryMovementRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: InventoryMovementSummary;
}
