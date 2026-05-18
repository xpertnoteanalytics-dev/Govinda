import { NextResponse } from "next/server";
import { backendLogout } from "@/lib/session/backend";
import { clearSessionCookies, getServerSession } from "@/lib/session/server";

export async function POST() {
  const { accessToken } = await getServerSession();

  if (accessToken) {
    try {
      await backendLogout(accessToken);
    } catch {
      // proceed with local cleanup
    }
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookies(response);
  return response;
}
