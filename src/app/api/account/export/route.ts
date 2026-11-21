import { getCurrentUser } from "@/server/auth/session";
import { exportUserData } from "@/server/account/privacy";
import { rateLimit } from "@/server/security/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in", { status: 401 });
  if (!(await rateLimit(`export:${user.id}`, 5, 3600)).ok) return new Response("Too many exports. Try again later.", { status: 429 });
  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="otaku-bazaar-my-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
