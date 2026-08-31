import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { ExpirationWriteOffRecord } from "../../../../types/expiration";

export async function GET(request: Request): Promise<NextResponse> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const apiUrl = new URL(`${getApiUrl()}/expirations/write-offs`);
  for (const parameter of ["storeId", "limit"]) {
    const value = requestUrl.searchParams.get(parameter);
    if (value !== null) apiUrl.searchParams.set(parameter, value);
  }

  try {
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 401) await clearAccessToken();
      const error = (await response
        .json()
        .catch(() => ({}))) as ApiErrorResponse;
      const message = Array.isArray(error.message)
        ? error.message[0]
        : error.message;
      return NextResponse.json(
        { message: message ?? "Não foi possível consultar o histórico." },
        { status: response.status },
      );
    }
    return NextResponse.json(
      (await response.json()) as ExpirationWriteOffRecord[],
    );
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de validades." },
      { status: 503 },
    );
  }
}
