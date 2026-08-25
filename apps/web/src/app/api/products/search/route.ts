import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { Product } from "../../../../types/product";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível buscar os produtos.";
  }

  return errorResponse.message ?? "Não foi possível buscar os produtos.";
}

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
  const apiUrl = new URL(`${getApiUrl()}/products/search`);

  for (const parameter of ["search", "limit"]) {
    const value = requestUrl.searchParams.get(parameter);

    if (value !== null) {
      apiUrl.searchParams.set(parameter, value);
    }
  }

  try {
    const apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!apiResponse.ok) {
      if (apiResponse.status === 401) {
        await clearAccessToken();
      }

      const errorResponse = await readErrorResponse(apiResponse);

      return NextResponse.json(
        { message: getErrorMessage(errorResponse) },
        { status: apiResponse.status },
      );
    }

    const products = (await apiResponse.json()) as Product[];

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de produtos." },
      { status: 503 },
    );
  }
}
