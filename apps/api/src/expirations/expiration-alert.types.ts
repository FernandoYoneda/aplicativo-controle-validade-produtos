import type { ExpirationAlertType } from '../../generated/prisma/enums';
import type { ExpirationRecord } from './expirations.service';

export interface ExpirationAlertAcknowledgement {
  id: string;
  acknowledgedAt: Date;
  user: {
    id: string;
    name: string;
  };
}

export interface ExpirationAlertItem extends ExpirationRecord {
  alertType: ExpirationAlertType;
  acknowledgement: ExpirationAlertAcknowledgement | null;
}

export interface ExpirationAlertSummary {
  total: number;
  expired: number;
  upcoming: number;
  pending: number;
  reviewed: number;
}

export interface ExpirationAlertPage {
  items: ExpirationAlertItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: ExpirationAlertSummary;
}
