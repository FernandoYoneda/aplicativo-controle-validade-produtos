import { NextResponse } from "next/server";
import { clearAccessToken, getAuthenticatedUser } from "../../../../lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      await clearAccessToken();

      return NextResponse.json(
        {
          message: "Sessão inválida ou expirada.",
        },
        {
          status: 401,
        },
      );
    }

    return NextResponse.json({
      user,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Não foi possível consultar a sessão. Tente novamente.",
      },
      {
        status: 503,
      },
    );
  }
}
