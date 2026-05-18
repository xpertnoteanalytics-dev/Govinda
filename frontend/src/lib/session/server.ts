import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_REFRESH,
  AUTH_COOKIE_USER,
} from "@/lib/constants";
import type { AuthUser } from "@/lib/auth";

const ACCESS_MAX_AGE = 60 * 60; // 1 hour
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const USER_MAX_AGE = 60 * 60 * 24 * 7;

const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setSessionCookies(
  response: NextResponse,
  session: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }
) {
  response.cookies.set(AUTH_COOKIE_ACCESS, session.accessToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: ACCESS_MAX_AGE,
  });
  response.cookies.set(AUTH_COOKIE_REFRESH, session.refreshToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: REFRESH_MAX_AGE,
  });
  response.cookies.set(AUTH_COOKIE_USER, JSON.stringify(session.user), {
    ...cookieOptions,
    httpOnly: false,
    maxAge: USER_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_ACCESS, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_REFRESH, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_USER, "", { ...cookieOptions, maxAge: 0 });
}

export async function getServerSession(): Promise<{
  accessToken: string | undefined;
  refreshToken: string | undefined;
  user: AuthUser | null;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_ACCESS)?.value;
  const refreshToken = cookieStore.get(AUTH_COOKIE_REFRESH)?.value;
  const userRaw = cookieStore.get(AUTH_COOKIE_USER)?.value;

  let user: AuthUser | null = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as AuthUser;
    } catch {
      user = null;
    }
  }

  return { accessToken, refreshToken, user };
}

export function parseUserCookie(value: string | undefined): AuthUser | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}
