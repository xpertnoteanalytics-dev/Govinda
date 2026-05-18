import { NextRequest, NextResponse } from "next/server";
import { backendSignup } from "@/lib/session/backend";
import { setSessionCookies } from "@/lib/session/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await backendSignup(body);

    const response = NextResponse.json({ success: true, user: data.user });
    setSessionCookies(response, {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: data.user,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : "Signup failed" } },
      { status: 400 }
    );
  }
}
