import "server-only";

import type { Product, ProductPage } from "../types/product";
import { getAccessToken, getApiUrl } from "./auth";

export async function getProducts(): Promise<Product[] | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/products`, {
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
      `Não foi possível consultar os produtos: ${response.status}.`,
    );
  }

  return (await response.json()) as Product[];
}

export async function getProductPage(): Promise<ProductPage | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/products/page`, {
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
      `Não foi possível consultar a página de produtos: ${response.status}.`,
    );
  }

  return (await response.json()) as ProductPage;
}
