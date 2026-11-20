import { NextResponse } from "next/server";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/request";
import { storeImage, UploadError } from "@/server/storage";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { audit } from "@/server/audit";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await assertPermission("products.write");
    await enforceRateLimit(`upload:${user.id}`, 60, 60 * 10);
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File).slice(0, 10);
    if (!files.length) return NextResponse.json({ error: "No file received." }, { status: 400 });
    const uploaded = [];
    for (const f of files) uploaded.push(await storeImage(f));
    await audit({ actorId: user.id, action: "media.upload", entityType: "Media", data: { urls: uploaded.map((u) => u.url) } });
    return NextResponse.json({ files: uploaded });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof UploadError || err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
