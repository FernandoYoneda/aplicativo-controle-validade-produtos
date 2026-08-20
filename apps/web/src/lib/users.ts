import "server-only";

import type { StoreUser } from "../types/user";
import { getAccessToken, getApiUrl } from "./auth";

export async function getStoreUsers(): Promise<StoreUser[] | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/users`, {
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
    throw new Error(
      `Não foi possível consultar os usuários: ${response.status}.`,
    );
  }

  return (await response.json()) as StoreUser[];
}
