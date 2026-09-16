import type { ExpirationWriteOffRecord } from './expiration-write-off.types';

export type InventoryMovementType = 'WRITE_OFF' | 'REVERSAL';

type InventoryMovementActor = ExpirationWriteOffRecord['performedBy'];
type InventoryMovementProductLot = ExpirationWriteOffRecord['productLot'];

export interface InventoryMovementRecord {
  id: string;
  writeOffId: string;
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
  writeOffs: number;
  reversals: number;
  writtenOffQuantity: number;
  restoredQuantity: number;
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
