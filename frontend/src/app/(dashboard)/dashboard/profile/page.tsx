import { cookies } from "next/headers";
import { PageTransition } from "@/components/ui/motion";
import { ProfilePanel } from "@/components/dashboard/ProfilePanel";
import { parseUserCookie } from "@/lib/session/server";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const user = parseUserCookie(cookieStore.get("govinda_user")?.value);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-ink">Profile</h2>
          <p className="mt-1 text-ink-muted">
            Manage your account and organization membership
          </p>
        </div>
        <ProfilePanel initialUser={user} />
      </div>
    </PageTransition>
  );
}
