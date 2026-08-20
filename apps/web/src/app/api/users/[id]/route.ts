import { NextResponse } from "next/server";
import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";
import type { StoreUser, UpdateUserPayload } from "../../../../types/user";

interface UserRouteContext {
  params: Promise<{
    id: string;
  }>;
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível atualizar o usuário.";
  }

  return errorResponse.message ?? "Não foi possível atualizar o usuário.";
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

function isUpdateUserPayload(value: unknown): value is UpdateUserPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const hasName = payload.name !== undefined;
  const hasEmail = payload.email !== undefined;
  const hasLogin = payload.login !== undefined;
  const hasPassword = payload.password !== undefined;
  const hasStoreId = payload.storeId !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (
    !hasName &&
    !hasEmail &&
    !hasLogin &&
    !hasPassword &&
    !hasStoreId &&
    !hasIsActive
  ) {
    return false;
  }

  return (
    (!hasName || typeof payload.name === "string") &&
    (!hasEmail || typeof payload.email === "string") &&
    (!hasLogin || typeof payload.login === "string") &&
    (!hasPassword || typeof payload.password === "string") &&
    (!hasStoreId || typeof payload.storeId === "string") &&
    (!hasIsActive || typeof payload.isActive === "boolean")
  );
}

export async function PATCH(
  request: Request,
  context: UserRouteContext,
): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Dados do usuário inválidos." },
      { status: 400 },
    );
  }

  if (!isUpdateUserPayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe ao menos um campo para atualização.",
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${getApiUrl()}/users/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          login: payload.login,
          password: payload.password,
          storeId: payload.storeId,
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
        { message: getErrorMessage(errorResponse) },
        { status: apiResponse.status },
      );
    }

    const user = (await apiResponse.json()) as StoreUser;

    return NextResponse.json(user, {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de usuários.",
      },
      { status: 503 },
    );
  }
}
