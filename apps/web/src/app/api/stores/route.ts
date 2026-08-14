import { NextResponse } from "next/server";
import { clearAccessToken, getAccessToken, getApiUrl } from "../../../lib/auth";
import type { ApiErrorResponse } from "../../../types/auth";
import type { CreateStorePayload, Store } from "../../../types/store";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível concluir a operação.";
  }

  return errorResponse.message ?? "Não foi possível concluir a operação.";
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

function isCreateStorePayload(value: unknown): value is CreateStorePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return typeof payload.code === "string" && typeof payload.name === "string";
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
    const apiResponse = await fetch(`${getApiUrl()}/stores`, {
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

    const stores = (await apiResponse.json()) as Store[];

    return NextResponse.json(stores);
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
        message: "Dados da loja inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isCreateStorePayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe o código e o nome da loja.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/stores`, {
      method: "POST",
      headers: {
        ...authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: payload.code,
        name: payload.name,
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
