export interface Store {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorePayload {
  code: string;
  name: string;
}

export interface UpdateStorePayload {
  code?: string;
  name?: string;
  isActive?: boolean;
}
