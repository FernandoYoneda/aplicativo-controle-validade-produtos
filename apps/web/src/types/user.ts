export interface UserStore {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface StoreUser {
  id: string;
  name: string;
  email: string;
  login: string;
  role: "STORE_USER";
  storeId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  store: UserStore | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  login: string;
  password: string;
  storeId: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  login?: string;
  password?: string;
  storeId?: string;
  isActive?: boolean;
}
