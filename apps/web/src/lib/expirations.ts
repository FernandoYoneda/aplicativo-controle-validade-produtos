import "server-only";

import type {
  ExpirationAlertPage,
  ExpirationOverview,
  ExpirationPage,
  ExpirationRecord,
} from "../types/expiration";
import { getAccessToken, getApiUrl } from "./auth";

interface ExpirationPageQuery {
  page?: number;
  search?: string;
  status?: string;
  storeId?: string;
}

interface ExpirationAlertsQuery extends ExpirationPageQuery {
  review?: string;
}

function createQueryString(query: ExpirationAlertsQuery): string {
  const parameters = new URLSearchParams();

  if (query.page && query.page > 1) parameters.set("page", String(query.page));
  if (query.search) parameters.set("search", query.search);
  if (query.status && query.status !== "all") {
    parameters.set("status", query.status);
  }
  if (query.review && query.review !== "all") {
    parameters.set("review", query.review);
  }
  if (query.storeId) parameters.set("storeId", query.storeId);

  const value = parameters.toString();
  return value ? `?${value}` : "";
}

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

export async function getExpirationPage(
  query: ExpirationPageQuery = {},
): Promise<ExpirationPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${getApiUrl()}/expirations/page${createQueryString(query)}`,
    {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    },
  );

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

export async function getExpirationAlerts(
  query: ExpirationAlertsQuery = {},
): Promise<ExpirationAlertPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${getApiUrl()}/expirations/alerts${createQueryString(query)}`,
    {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    },
  );

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
