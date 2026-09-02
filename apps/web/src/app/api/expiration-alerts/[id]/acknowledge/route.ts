import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../../types/auth";
import type { ExpirationAlertAcknowledgement } from "../../../../../types/expiration";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const apiResponse = await fetch(
      `${getApiUrl()}/expirations/${encodeURIComponent(id)}/alert-acknowledgements`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (!apiResponse.ok) {
      if (apiResponse.status === 401) {
        await clearAccessToken();
      }

      let error: ApiErrorResponse = {};
      try {
        error = (await apiResponse.json()) as ApiErrorResponse;
      } catch {
        error = {};
      }

      return NextResponse.json(
        { message: error.message ?? "Não foi possível verificar o alerta." },
        { status: apiResponse.status },
      );
    }

    return NextResponse.json(
      (await apiResponse.json()) as ExpirationAlertAcknowledgement,
    );
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de alertas." },
      { status: 503 },
    );
  }
}
