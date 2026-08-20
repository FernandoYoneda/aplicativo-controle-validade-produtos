import { NextResponse } from "next/server";

import { clearAccessToken, getAccessToken, getApiUrl } from "../../../lib/auth";
import type { ApiErrorResponse } from "../../../types/auth";
import type { CreateProductPayload, Product } from "../../../types/product";

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

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isCreateProductPayload(value: unknown): value is CreateProductPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.code === "string" &&
    typeof payload.name === "string" &&
    isOptionalNullableString(payload.barcode) &&
    isOptionalNullableString(payload.brand) &&
    isOptionalNullableString(payload.category)
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
    const apiResponse = await fetch(`${getApiUrl()}/products`, {
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

    const products = (await apiResponse.json()) as Product[];

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de produtos.",
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
        message: "Dados do produto inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isCreateProductPayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe o código e o nome do produto.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/products`, {
      method: "POST",
      headers: {
        ...authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: payload.code,
        barcode: payload.barcode,
        name: payload.name,
        brand: payload.brand,
        category: payload.category,
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

    const product = (await apiResponse.json()) as Product;

    return NextResponse.json(product, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de produtos.",
      },
      {
        status: 503,
      },
    );
  }
}
