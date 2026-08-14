import type { UserRole } from '../../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  login: string;
  role: UserRole;
  storeId: string | null;
}
