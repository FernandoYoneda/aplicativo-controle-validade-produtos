import { NextResponse } from "next/server";
import { getApiUrl, saveAccessToken } from "../../../../lib/auth";
import type {
  ApiErrorResponse,
  BackendLoginResponse,
} from "../../../../types/auth";

interface LoginPayload {
  identifier: string;
  password: string;
}

function isLoginPayload(value: unknown): value is LoginPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.identifier === "string" &&
    payload.identifier.trim().length > 0 &&
    typeof payload.password === "string" &&
    payload.password.length > 0
  );
}

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível entrar.";
  }

  return errorResponse.message ?? "Não foi possível entrar.";
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "Dados de acesso inválidos.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isLoginPayload(payload)) {
    return NextResponse.json(
      {
        message: "Informe o usuário e a senha.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const apiResponse = await fetch(`${getApiUrl()}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: payload.identifier.trim(),
        password: payload.password,
      }),
      cache: "no-store",
    });

    if (!apiResponse.ok) {
      const errorResponse = (await apiResponse.json()) as ApiErrorResponse;

      return NextResponse.json(
        {
          message: getErrorMessage(errorResponse),
        },
        {
          status: apiResponse.status,
        },
      );
    }

    const loginResponse = (await apiResponse.json()) as BackendLoginResponse;

    await saveAccessToken(loginResponse.accessToken, loginResponse.expiresIn);

    return NextResponse.json({
      user: loginResponse.user,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao serviço. Tente novamente.",
      },
      {
        status: 503,
      },
    );
  }
}
