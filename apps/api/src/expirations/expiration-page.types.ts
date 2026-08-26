import type { ExpirationRecord } from './expirations.service';

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
