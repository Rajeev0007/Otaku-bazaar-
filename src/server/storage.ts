import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // stays under serverless request body limits

const SIGNATURES: { type: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  { type: "image/avif", ext: "avif", test: (b) => b.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(b.subarray(8, 12).toString("ascii")) },
];

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Detects the real image type from file bytes. The browser-supplied MIME type is never trusted. SVG is rejected (can carry scripts). */
export function sniffImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

function s3() {
  const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION, MEDIA_PUBLIC_HOST } = process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !MEDIA_PUBLIC_HOST) return null;
  return {
    bucket: S3_BUCKET,
    host: MEDIA_PUBLIC_HOST,
    client: new S3Client({
      region: S3_REGION || "auto",
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: !!S3_ENDPOINT,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    }),
  };
}

export async function storeImage(file: File, folder = "products"): Promise<{ url: string; bytes: number; type: string }> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError(`Images must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new UploadError("Only JPEG, PNG, WebP or AVIF images are allowed.");
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}.${kind.ext}`;

  // Vercel Blob: connect a Blob store to the Vercel project and BLOB_READ_WRITE_TOKEN is set automatically.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, buf, { access: "public", contentType: kind.type, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
    return { url: blob.url, bytes: buf.length, type: kind.type };
  }

  const storage = s3();
  if (storage) {
    await storage.client.send(
      new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: buf, ContentType: kind.type, CacheControl: "public, max-age=31536000, immutable" }),
    );
    return { url: `https://${storage.host}/${key}`, bytes: buf.length, type: kind.type };
  }
  if (process.env.NODE_ENV === "production") {
    throw new UploadError("Image storage is not set up. In Vercel, open Storage → Create → Blob and connect it to this project, then redeploy.");
  }
  // Development fallback: local disk under public/uploads (git-ignored).
  const dest = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { url: `/uploads/${key}`, bytes: buf.length, type: kind.type };
}
