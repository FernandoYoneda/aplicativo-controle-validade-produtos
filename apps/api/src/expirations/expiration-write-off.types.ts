import type { Prisma } from '../../generated/prisma/client';
import type { ExpirationRecord } from './expirations.service';

export const expirationWriteOffReversalSelect = {
  id: true,
  restoredQuantity: true,
  previousQuantity: true,
  resultingQuantity: true,
  reason: true,
  notes: true,
  createdAt: true,
  reversedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ProductLotWriteOffReversalSelect;

export const expirationWriteOffSelect = {
  id: true,
  reason: true,
  quantity: true,
  previousQuantity: true,
  remainingQuantity: true,
  notes: true,
  createdAt: true,
  reversal: {
    select: expirationWriteOffReversalSelect,
  },
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
} satisfies Prisma.ProductLotWriteOffSelect;

export type ExpirationWriteOffRecord = Prisma.ProductLotWriteOffGetPayload<{
  select: typeof expirationWriteOffSelect;
}>;

export interface ExpirationWriteOffResult {
  expiration: ExpirationRecord;
  writeOff: ExpirationWriteOffRecord;
}

export interface ExpirationWriteOffReversalResult {
  expiration: ExpirationRecord;
  writeOff: ExpirationWriteOffRecord;
}
