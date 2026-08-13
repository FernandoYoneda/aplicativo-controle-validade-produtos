import "server-only";

import { cookies } from "next/headers";
import type { AuthenticatedUser } from "../types/auth";

export const ACCESS_TOKEN_COOKIE = "casabella_access_token";

export function getApiUrl(): string {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    throw new Error("API_URL não foi definida.");
  }

  return apiUrl.replace(/\/$/, "");
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function saveAccessToken(
  accessToken: string,
  expiresIn: number,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    priority: "high",
  });
}

export async function clearAccessToken(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl()}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as AuthenticatedUser;

  return user;
}
