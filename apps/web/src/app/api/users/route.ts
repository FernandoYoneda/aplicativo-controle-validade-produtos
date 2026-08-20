import { NextResponse } from "next/server";
import { clearAccessToken, getAccessToken, getApiUrl } from "../../../lib/auth";
import type { ApiErrorResponse } from "../../../types/auth";
import type { CreateUserPayload, StoreUser } from "../../../types/user";

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

function isCreateUserPayload(value: unknown): value is CreateUserPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.name === "string" &&
    typeof payload.email === "string" &&
    typeof payload.login === "string" &&
    typeof payload.password === "string" &&
    typeof payload.storeId === "string"
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
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/users`, {
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
        { message: getErrorMessage(errorResponse) },
        { status: apiResponse.status },
      );
    }

    const users = (await apiResponse.json()) as StoreUser[];

    return NextResponse.json(users);
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço de usuários.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authorizationHeader = await getAuthorizationHeader();

  if (!authorizationHeader) {
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

  if (!isCreateUserPayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe nome, e-mail, login, senha e loja.",
      },
      { status: 400 },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/users`, {
      method: "POST",
      headers: {
        ...authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        login: payload.login,
        password: payload.password,
        storeId: payload.storeId,
      }),
      cache: "no-store",
    });

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
