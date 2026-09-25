export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<{ mime: string; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const mime = "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("Could not process that image.");
  return { mime, base64 };
}

export function fileFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}
