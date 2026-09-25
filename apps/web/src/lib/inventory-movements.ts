import "server-only";

import type {
  InventoryMovementPage,
  InventoryMovementTypeFilter,
} from "../types/expiration";
import { getAccessToken, getApiUrl } from "./auth";

export interface InventoryMovementQuery {
  page?: number;
  search?: string;
  storeId?: string;
  type?: InventoryMovementTypeFilter;
  from?: string;
  to?: string;
}

export function createInventoryMovementQueryString(
  query: InventoryMovementQuery,
): string {
  const parameters = new URLSearchParams();

  if (query.page && query.page > 1) parameters.set("page", String(query.page));
  if (query.search) parameters.set("search", query.search);
  if (query.storeId) parameters.set("storeId", query.storeId);
  if (query.type && query.type !== "all") parameters.set("type", query.type);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);

  const value = parameters.toString();
  return value ? `?${value}` : "";
}

export async function getInventoryMovementPage(
  query: InventoryMovementQuery = {},
): Promise<InventoryMovementPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) return null;

  const response = await fetch(
    `${getApiUrl()}/expirations/inventory-movements${createInventoryMovementQueryString(query)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(
      `Não foi possível consultar as movimentações: ${response.status}.`,
    );
  }

  return (await response.json()) as InventoryMovementPage;
}
