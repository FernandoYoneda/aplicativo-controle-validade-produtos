import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { Product, UpdateProductPayload } from "../../../../types/product";

interface ProductRouteContext {
  params: Promise<{
    id: string;
  }>;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível atualizar o produto.";
  }

  return errorResponse.message ?? "Não foi possível atualizar o produto.";
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

function isUpdateProductPayload(value: unknown): value is UpdateProductPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const hasCode = payload.code !== undefined;
  const hasBarcode = payload.barcode !== undefined;
  const hasName = payload.name !== undefined;
  const hasBrand = payload.brand !== undefined;
  const hasCategory = payload.category !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (
    !hasCode &&
    !hasBarcode &&
    !hasName &&
    !hasBrand &&
    !hasCategory &&
    !hasIsActive
  ) {
    return false;
  }

  return (
    (!hasCode || typeof payload.code === "string") &&
    (!hasBarcode || isOptionalNullableString(payload.barcode)) &&
    (!hasName || typeof payload.name === "string") &&
    (!hasBrand || isOptionalNullableString(payload.brand)) &&
    (!hasCategory || isOptionalNullableString(payload.category)) &&
    (!hasIsActive || typeof payload.isActive === "boolean")
  );
}

export async function PATCH(
  request: Request,
  context: ProductRouteContext,
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
        message: "Dados do produto inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isUpdateProductPayload(payload)) {
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
      `${getApiUrl()}/products/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: payload.code,
          barcode: payload.barcode,
          name: payload.name,
          brand: payload.brand,
          category: payload.category,
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
