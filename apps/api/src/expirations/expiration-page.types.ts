import type { ExpirationRecord } from './expirations.service';

export interface ExpirationPage {
  items: ExpirationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalRecords: number;
    expiredRecords: number;
    upcomingRecords: number;
    inactiveRecords: number;
  };
}
