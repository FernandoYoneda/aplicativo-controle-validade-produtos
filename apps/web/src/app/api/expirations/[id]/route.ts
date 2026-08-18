import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type {
  ExpirationRecord,
  UpdateExpirationPayload,
} from "../../../../types/expiration";

interface ExpirationRouteContext {
  params: Promise<{
    id: string;
  }>;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return (
      errorResponse.message[0] ??
      "Não foi possível atualizar o registro de validade."
    );
  }

  return (
    errorResponse.message ??
    "Não foi possível atualizar o registro de validade."
  );
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

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isUpdateExpirationPayload(
  value: unknown,
): value is UpdateExpirationPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const hasBatchNumber = payload.batchNumber !== undefined;
  const hasExpirationDate = payload.expirationDate !== undefined;
  const hasQuantity = payload.quantity !== undefined;
  const hasNotes = payload.notes !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (
    !hasBatchNumber &&
    !hasExpirationDate &&
    !hasQuantity &&
    !hasNotes &&
    !hasIsActive
  ) {
    return false;
  }

  return (
    (!hasBatchNumber || isOptionalNullableString(payload.batchNumber)) &&
    (!hasExpirationDate || typeof payload.expirationDate === "string") &&
    (!hasQuantity || typeof payload.quantity === "number") &&
    (!hasNotes || isOptionalNullableString(payload.notes)) &&
    (!hasIsActive || typeof payload.isActive === "boolean")
  );
}

export async function PATCH(
  request: Request,
  context: ExpirationRouteContext,
): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      {
        message: "Sessão não encontrada.",
      },
      {
        status: 401,
      },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "Dados da validade inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isUpdateExpirationPayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe ao menos um campo para atualização.",
      },
      {
        status: 400,
      },
    );
  }

  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${getApiUrl()}/expirations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchNumber: payload.batchNumber,
          expirationDate: payload.expirationDate,
          quantity: payload.quantity,
          notes: payload.notes,
          isActive: payload.isActive,
        }),
        cache: "no-store",
      },
    );

    if (!apiResponse.ok) {
      if (apiResponse.status === 401) {
        await clearAccessToken();
      }

      const errorResponse = await readErrorResponse(apiResponse);

      return NextResponse.json(
        {
          message: getErrorMessage(errorResponse),
        },
        {
          status: apiResponse.status,
        },
      );
    }

    const expiration = (await apiResponse.json()) as ExpirationRecord;

    return NextResponse.json(expiration, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de validades.",
      },
      {
        status: 503,
      },
    );
  }
}
