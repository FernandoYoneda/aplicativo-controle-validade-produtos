export type UserRole = "ADMIN" | "STORE_USER";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  login: string;
  role: UserRole;
  storeId: string | null;
}

export interface BackendLoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface SessionResponse {
  user: AuthenticatedUser;
}

export interface ApiErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}
