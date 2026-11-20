import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-5xl font-semibold text-accent">403</p>
        <h1 className="mt-3 text-xl font-semibold">You don't have access to this area</h1>
        <p className="mt-2 text-sm text-muted">
          {user?.isStaff ? "Ask a Super Admin to grant your role the required permission." : "This area is for store staff only."}
        </p>
        <Link href={user?.isStaff ? "/admin" : "/"} className="mt-6 inline-flex h-10 items-center rounded-full bg-fg px-4 text-sm font-semibold text-bg">
          {user?.isStaff ? "Back to dashboard" : "Back to store"}
        </Link>
      </div>
    </div>
  );
}
