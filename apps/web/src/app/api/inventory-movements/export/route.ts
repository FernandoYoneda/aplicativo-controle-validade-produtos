import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";

const forwardedParameters = ["search", "storeId", "type", "from", "to"];

export async function GET(request: Request): Promise<Response> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const apiUrl = new URL(
    `${getApiUrl()}/expirations/inventory-movements/export`,
  );
  for (const parameter of forwardedParameters) {
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
        { message: message ?? "Não foi possível exportar as movimentações." },
        { status: response.status },
      );
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          response.headers.get("content-disposition") ??
          'attachment; filename="movimentacoes-estoque.xlsx"',
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
