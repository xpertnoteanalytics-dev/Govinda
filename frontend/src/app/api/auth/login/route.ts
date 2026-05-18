import { NextRequest, NextResponse } from "next/server";
import {
  backendLogin,
  backendSignup,
  backendRefresh,
  backendLogout,
  backendGetMe,
} from "@/lib/session/backend";
import {
  setSessionCookies,
  clearSessionCookies,
  getServerSession,
} from "@/lib/session/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await backendLogin(body);

    const response = NextResponse.json({ success: true, user: data.user });
    setSessionCookies(response, {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: data.user,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : "Login failed" } },
      { status: 401 }
    );
  }
}
