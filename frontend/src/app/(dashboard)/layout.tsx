import { cookies } from "next/headers";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { parseUserCookie } from "@/lib/session/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const user = parseUserCookie(cookieStore.get("govinda_user")?.value);

  return (
    <AuthProvider initialUser={user}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}

