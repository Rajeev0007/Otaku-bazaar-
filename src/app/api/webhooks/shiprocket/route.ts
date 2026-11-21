import { NextResponse } from "next/server";
import { applyTrackingUpdate, verifyShiprocketWebhook } from "@/server/shipping/shiprocket";

// Shiprocket → Settings → API → Webhooks. URL and token are shown in Admin → Integrations → Shipping.
export async function POST(req: Request) {
  if (!(await verifyShiprocketWebhook(req.headers.get("x-api-key")))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { awb?: string | number; current_status?: string; shipment_status?: string; scans?: { location?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const awb = body.awb ? String(body.awb) : "";
  const status = body.current_status ?? body.shipment_status ?? "";
  if (!awb || !status) return NextResponse.json({ ok: true, ignored: true });
  try {
    const r = await applyTrackingUpdate(awb, status, { location: body.scans?.at(-1)?.location });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[webhook shiprocket]", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
