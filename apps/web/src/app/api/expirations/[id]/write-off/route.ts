import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../../types/auth";
import type {
  CreateWriteOffPayload,
  ExpirationWriteOffResult,
} from "../../../../../types/expiration";

export async function POST(
  request: Request,
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
  const payload = (await request.json()) as CreateWriteOffPayload;

  try {
    const response = await fetch(`${getApiUrl()}/expirations/${id}/write-off`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
        { message: message ?? "Não foi possível registrar a baixa." },
        { status: response.status },
      );
    }
    return NextResponse.json(
      (await response.json()) as ExpirationWriteOffResult,
    );
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de validades." },
      { status: 503 },
    );
  }
}
