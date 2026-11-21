import { db } from "@/server/db";

// Serves images stored in the database (used when no Blob/S3 storage is connected). IDs are random and immutable.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const file = await db.mediaFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
