import { NextResponse } from "next/server";
import { backendRefresh, backendGetMe } from "@/lib/session/backend";
import { getServerSession, setSessionCookies, clearSessionCookies } from "@/lib/session/server";

export async function POST() {
  const { refreshToken, user } = await getServerSession();

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { message: "No refresh token" } },
      { status: 401 }
    );
  }

  try {
    const data = await backendRefresh(refreshToken);
    let resolvedUser = user;
    if (!resolvedUser) {
      const me = await backendGetMe(data.tokens.accessToken);
      resolvedUser = me.user;
    }

    const response = NextResponse.json({ success: true });
    setSessionCookies(response, {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user: resolvedUser!,
    });
    return response;
  } catch {
    const response = NextResponse.json(
      { success: false, error: { message: "Session expired" } },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
  }
}
