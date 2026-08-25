import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { ProductPage } from "../../../../types/product";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível listar os produtos.";
  }

  return errorResponse.message ?? "Não foi possível listar os produtos.";
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
  const apiUrl = new URL(`${getApiUrl()}/products/page`);

  for (const parameter of ["page", "pageSize", "search"]) {
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

    const productPage = (await apiResponse.json()) as ProductPage;

    return NextResponse.json(productPage);
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de produtos." },
      { status: 503 },
    );
  }
}
