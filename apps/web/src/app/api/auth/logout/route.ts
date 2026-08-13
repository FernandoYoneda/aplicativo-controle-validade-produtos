import { NextResponse } from "next/server";
import { clearAccessToken } from "../../../../lib/auth";

export async function POST(): Promise<NextResponse> {
  await clearAccessToken();

  return NextResponse.json({
    message: "Sessão encerrada com sucesso.",
  });
}
