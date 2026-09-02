import { NextResponse } from "next/server";

import { clearAccessToken, getAccessToken, getApiUrl } from "../../../lib/auth";
import type { ApiErrorResponse } from "../../../types/auth";
import type { ExpirationAlertPage } from "../../../types/expiration";

async function readErrorResponse(
  response: Response,
): Promise<ApiErrorResponse> {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return {};
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const apiUrl = new URL(`${getApiUrl()}/expirations/alerts`);

  for (const parameter of [
    "page",
    "pageSize",
    "search",
    "status",
    "review",
    "storeId",
  ]) {
    const value = requestUrl.searchParams.get(parameter);

    if (value !== null) {
      apiUrl.searchParams.set(parameter, value);
    }
  }

  try {
    const apiResponse = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!apiResponse.ok) {
      if (apiResponse.status === 401) {
        await clearAccessToken();
      }

      const error = await readErrorResponse(apiResponse);
      return NextResponse.json(
        { message: error.message ?? "Não foi possível listar os alertas." },
        { status: apiResponse.status },
      );
    }

    return NextResponse.json((await apiResponse.json()) as ExpirationAlertPage);
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de alertas." },
      { status: 503 },
    );
  }
}
