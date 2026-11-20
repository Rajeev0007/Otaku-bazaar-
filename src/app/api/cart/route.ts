import { NextResponse } from "next/server";
import { buildCartView } from "@/server/cart/service";
import { getCurrentCart } from "@/server/shopper";

export const dynamic = "force-dynamic";

export async function GET() {
  const view = await buildCartView(await getCurrentCart());
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
}
