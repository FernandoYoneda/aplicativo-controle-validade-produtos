import { NextResponse } from "next/server";

import {
  clearAccessToken,
  getAccessToken,
  getApiUrl,
} from "../../../../lib/auth";
import type { ApiErrorResponse } from "../../../../types/auth";

function getErrorMessage(errorResponse: ApiErrorResponse): string {
  if (Array.isArray(errorResponse.message)) {
    return errorResponse.message[0] ?? "Não foi possível importar a planilha.";
  }

  return errorResponse.message ?? "Não foi possível importar a planilha.";
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

export async function POST(request: Request): Promise<NextResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const mode = new URL(request.url).searchParams.get("mode");

  if (mode !== "preview" && mode !== "confirm") {
    return NextResponse.json(
      { message: "Operação de importação inválida." },
      { status: 400 },
    );
  }

  let incomingFormData: FormData;

  try {
    incomingFormData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Não foi possível ler o arquivo enviado." },
      { status: 400 },
    );
  }

  const file = incomingFormData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Selecione uma planilha para importar." },
      { status: 400 },
    );
  }

  const apiFormData = new FormData();
  apiFormData.append("file", file, file.name);

  try {
    const endpoint = mode === "preview" ? "import/preview" : "import";
    const apiResponse = await fetch(`${getApiUrl()}/products/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: apiFormData,
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

    return NextResponse.json(await apiResponse.json(), {
      status: apiResponse.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível conectar ao serviço de produtos." },
      { status: 503 },
    );
  }
}
