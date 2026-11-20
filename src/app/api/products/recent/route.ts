import { NextResponse } from "next/server";
import { productsByIds } from "@/server/catalog/queries";
import { getCurrentUser } from "@/server/auth/session";
import { recentlyViewedIds } from "@/server/wishlist/service";

export const dynamic = "force-dynamic";

/** Recently viewed products: this device's IDs merged with the signed-in account's history. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const deviceIds = raw.split(",").filter((id) => /^[a-z0-9]{10,40}$/i.test(id)).slice(0, 20);
  const user = await getCurrentUser();
  const accountIds = user ? await recentlyViewedIds(user.id, 12) : [];
  const ids = [...new Set([...deviceIds, ...accountIds])].slice(0, 12);
  const products = await productsByIds(ids);
  return NextResponse.json(products, { headers: { "Cache-Control": "private, no-store" } });
}
