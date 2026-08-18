import { NextResponse } from "next/server";

import { clearAccessToken, getAccessToken, getApiUrl } from "../../../lib/auth";
import type { ApiErrorResponse } from "../../../types/auth";
import type {
  CreateExpirationPayload,
  ExpirationRecord,
} from "../../../types/expiration";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return (
      errorResponse.message[0] ??
      "Não foi possível concluir a operação de validade."
    );
  }

  return (
    errorResponse.message ?? "Não foi possível concluir a operação de validade."
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

function isCreateExpirationPayload(
  value: unknown,
): value is CreateExpirationPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.productId === "string" &&
    (payload.storeId === undefined || typeof payload.storeId === "string") &&
    isOptionalNullableString(payload.batchNumber) &&
    typeof payload.expirationDate === "string" &&
    typeof payload.quantity === "number" &&
    isOptionalNullableString(payload.notes)
  );
}

async function getAuthorizationHeader(): Promise<Record<
  string,
  string
> | null> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return null;
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function GET(): Promise<NextResponse> {
  const authorizationHeader = await getAuthorizationHeader();

  if (!authorizationHeader) {
    return NextResponse.json(
      {
        message: "Sessão não encontrada.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/expirations`, {
      method: "GET",
      headers: authorizationHeader,
      cache: "no-store",
    });

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

    const expirations = (await apiResponse.json()) as ExpirationRecord[];

    return NextResponse.json(expirations);
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

export async function POST(request: Request): Promise<NextResponse> {
  const authorizationHeader = await getAuthorizationHeader();

  if (!authorizationHeader) {
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

  if (!isCreateExpirationPayload(payload)) {
    return NextResponse.json(
      {
        message:
          "Informe o produto, a data de validade e uma quantidade válida.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/expirations`, {
      method: "POST",
      headers: {
        ...authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: payload.productId,
        storeId: payload.storeId,
        batchNumber: payload.batchNumber,
        expirationDate: payload.expirationDate,
        quantity: payload.quantity,
        notes: payload.notes,
      }),
      cache: "no-store",
    });

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
