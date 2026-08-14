import { NextResponse } from "next/server";
import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { Store, UpdateStorePayload } from "../../../../types/store";

interface StoreRouteContext {
  params: Promise<{
    id: string;
  }>;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível atualizar a loja.";
  }

  return errorResponse.message ?? "Não foi possível atualizar a loja.";
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

function isUpdateStorePayload(value: unknown): value is UpdateStorePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const hasCode = payload.code !== undefined;
  const hasName = payload.name !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (!hasCode && !hasName && !hasIsActive) {
    return false;
  }

  return (
    (!hasCode || typeof payload.code === "string") &&
    (!hasName || typeof payload.name === "string") &&
    (!hasIsActive || typeof payload.isActive === "boolean")
  );
}

export async function PATCH(
  request: Request,
  context: StoreRouteContext,
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
        message: "Dados da loja inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isUpdateStorePayload(payload)) {
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
      `${getApiUrl()}/stores/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: payload.code,
          name: payload.name,
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

    const store = (await apiResponse.json()) as Store;

    return NextResponse.json(store, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de lojas.",
      },
      {
        status: 503,
      },
    );
  }
}
