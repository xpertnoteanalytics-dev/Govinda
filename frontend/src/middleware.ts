import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/signup"];
const PROTECTED_PREFIX = "/dashboard";

function copySetCookieHeaders(from: Response, to: NextResponse) {
  // Next.js fetch collapses multiple Set-Cookie headers into a single string in some runtimes.
  // We append what we get; the refresh route already sets all cookies with proper attributes.
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      to.headers.append("set-cookie", value);
    }
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("govinda_access_token")?.value;
  const refreshToken = request.cookies.get("govinda_refresh_token")?.value;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isProtected = pathname.startsWith(PROTECTED_PREFIX);

  if (isProtected && !accessToken) {
    if (refreshToken) {
      try {
        const refreshUrl = new URL("/api/auth/refresh", request.url);
        const refreshRes = await fetch(refreshUrl, {
          method: "POST",
          headers: { Cookie: request.headers.get("cookie") ?? "" },
        });

        if (refreshRes.ok) {
          const response = NextResponse.next();
          copySetCookieHeaders(refreshRes, response);
          return response;
        }

        // Refresh failed (401). The refresh route clears cookies via Set-Cookie,
        // but we must forward those headers even when redirecting.
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        const redirectRes = NextResponse.redirect(loginUrl);
        copySetCookieHeaders(refreshRes, redirectRes);
        return redirectRes;
      } catch {
        // fall through to login redirect
      }
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
