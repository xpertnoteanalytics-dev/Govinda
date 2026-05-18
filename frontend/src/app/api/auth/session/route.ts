import { NextResponse } from "next/server";
import { backendGetMe, backendRefresh } from "@/lib/session/backend";
import { getServerSession, setSessionCookies, clearSessionCookies } from "@/lib/session/server";

export async function GET() {
  let { accessToken, refreshToken, user } = await getServerSession();

  if (!refreshToken && !accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    if (accessToken) {
      const data = await backendGetMe(accessToken);
      user = data.user;

      const response = NextResponse.json({ authenticated: true, user });
      if (user) {
        response.cookies.set("govinda_user", JSON.stringify(user), {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      return response;
    }
  } catch {
    // access token expired — fall through to refresh
  }

  if (refreshToken) {
    try {
      const data = await backendRefresh(refreshToken);
      let resolvedUser = user;
      if (!resolvedUser) {
        const me = await backendGetMe(data.tokens.accessToken);
        resolvedUser = me.user;
      }

      const response = NextResponse.json({ authenticated: true, user: resolvedUser });
      setSessionCookies(response, {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        user: resolvedUser!,
      });
      return response;
    } catch {
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
