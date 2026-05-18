import { NextRequest, NextResponse } from "next/server";
import { backendProxy, backendRefresh, backendGetMe } from "@/lib/session/backend";
import { getServerSession, setSessionCookies } from "@/lib/session/server";

type RouteContext = { params: Promise<{ path: string[] }> };

async function resolveAuth() {
  const session = await getServerSession();

  if (session.accessToken) {
    return session;
  }

  if (session.refreshToken) {
    const data = await backendRefresh(session.refreshToken);
    let user = session.user;
    if (!user) {
      const me = await backendGetMe(data.tokens.accessToken);
      user = me.user;
    }
    return {
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      user,
      refreshed: true,
    };
  }

  return null;
}

async function handleProxy(
  request: NextRequest,
  context: RouteContext,
  method: string
) {
  const auth = await resolveAuth();
  if (!auth?.accessToken) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { path } = await context.params;
  const apiPath = `/${path.join("/")}`;
  const body =
    method !== "GET" && method !== "HEAD" ? await request.text() : undefined;

  try {
    const data = await backendProxy(apiPath, auth.accessToken, {
      method,
      body: body || undefined,
    });

    const response = NextResponse.json({ success: true, data });

    if ("refreshed" in auth && auth.refreshed && auth.refreshToken && auth.user) {
      setSessionCookies(response, {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: auth.user,
      });
    }

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: { message: err instanceof Error ? err.message : "Request failed" },
      },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context, "GET");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context, "PATCH");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxy(request, context, "POST");
}
