"use client";

// Shrinks large phone photos in the browser before upload (max 2000px, WebP/JPEG ~85%),
// so uploads are fast on mobile data and never hit the 4 MB server limit.
export async function prepareImage(file: File, maxSide = 2000): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
  if (file.size < 900_000 && file.type !== "image/png") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const type = canvas.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, type === "image/webp" ? ".webp" : ".jpg"), { type });
  } catch {
    return file; // unsupported format in this browser: upload as-is, the server validates it
  }
}
