import "server-only";

import type { Store } from "../types/store";
import { getAccessToken, getApiUrl } from "./auth";

export async function getStores(): Promise<Store[] | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/stores`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Não foi possível consultar as lojas: ${response.status}.`);
  }

  return (await response.json()) as Store[];
}
