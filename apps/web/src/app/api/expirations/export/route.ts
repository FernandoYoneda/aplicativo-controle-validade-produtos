import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return (
      errorResponse.message[0] ?? "Não foi possível exportar as validades."
    );
  }

  return errorResponse.message ?? "Não foi possível exportar as validades.";
}

export async function GET(request: Request): Promise<Response> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const apiUrl = new URL(`${getApiUrl()}/expirations/export`);

  for (const parameter of ["search", "status", "storeId"]) {
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

      let errorResponse: ApiErrorResponse = {};

      try {
        errorResponse = (await apiResponse.json()) as ApiErrorResponse;
      } catch {
        errorResponse = {};
      }

      return NextResponse.json(
        { message: getErrorMessage(errorResponse) },
        { status: apiResponse.status },
      );
    }

    return new Response(await apiResponse.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type":
          apiResponse.headers.get("content-type") ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          apiResponse.headers.get("content-disposition") ??
          'attachment; filename="validades.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de validades." },
      { status: 503 },
    );
  }
}
