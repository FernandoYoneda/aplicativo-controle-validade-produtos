import "server-only";

import type { ExpirationPage, ExpirationRecord } from "../types/expiration";
import { getAccessToken, getApiUrl } from "./auth";

export async function getExpirations(): Promise<ExpirationRecord[] | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/expirations`, {
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
      `Não foi possível consultar os registros de validade: ${response.status}.`,
    );
  }

  return (await response.json()) as ExpirationRecord[];
}

export async function getExpirationPage(): Promise<ExpirationPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/expirations/page`, {
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
      `Não foi possível consultar a página de validades: ${response.status}.`,
    );
  }

  return (await response.json()) as ExpirationPage;
}
