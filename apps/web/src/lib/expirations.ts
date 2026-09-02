import "server-only";

import type {
  ExpirationAlertPage,
  ExpirationOverview,
  ExpirationPage,
  ExpirationRecord,
} from "../types/expiration";
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

export async function getExpirationOverview(): Promise<ExpirationOverview | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/expirations/overview`, {
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
      `Não foi possível consultar os indicadores de validade: ${response.status}.`,
    );
  }

  return (await response.json()) as ExpirationOverview;
}

export async function getExpirationAlerts(): Promise<ExpirationAlertPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/expirations/alerts`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Não foi possível consultar a central de alertas: ${response.status}.`,
    );
  }

  return (await response.json()) as ExpirationAlertPage;
}
