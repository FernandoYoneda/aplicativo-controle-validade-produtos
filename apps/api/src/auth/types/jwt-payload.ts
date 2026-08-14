import type { UserRole } from '../../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  storeId: string | null;
  iat?: number;
  exp?: number;
}
