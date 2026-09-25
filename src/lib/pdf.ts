export type PageImage = {
  mime: "image/jpeg";
  base64: string;
  page: number;
  width: number;
  height: number;
};

/** Text from every page — cheap, and mark schemes are almost always selectable. */
export const MAX_TEXT_PAGES = 120;
/** Rendered pages kept in the browser. Official papers are typically 16–32 pages. */
export const MAX_RENDER_PAGES = 80;
/** Images per server request — keeps the upload under Vercel’s body limit. */
export const MARK_CHUNK_PAGES = 6;
export const MARK_CHUNK_OVERLAP = 1;

const MAX_EDGE = 1100;
const TARGET_B64 = 140_000;

function looksLikeMarkScheme(name: string, text: string): boolean {
  const n = name.toLowerCase();
  if (/(mark\s*scheme|\bms\b|markscheme|scheme|answers)/i.test(n) && !/script|completed|worked/i.test(n)) {
    return true;
  }
  const hits = (text.match(/\b(M1|A1|B1|P1|cao|oe\b|ft\b|follow through|additional guidance|mark scheme)\b/gi) ?? []).length;
  return hits >= 4;
}

export function classifyPair(
  a: { name: string; text: string },
  b: { name: string; text: string },
): { paperFirst: boolean; reason: string } {
  const aMs = looksLikeMarkScheme(a.name, a.text);
  const bMs = looksLikeMarkScheme(b.name, b.text);
  if (aMs && !bMs) return { paperFirst: false, reason: `${a.name} reads as a mark scheme.` };
  if (bMs && !aMs) return { paperFirst: true, reason: `${b.name} reads as a mark scheme.` };
  return { paperFirst: true, reason: "First file treated as your paper, second as the mark scheme. Swap if that is wrong." };
}

export function chunkPages<T>(items: T[], size = MARK_CHUNK_PAGES, overlap = MARK_CHUNK_OVERLAP): T[][] {
  if (items.length <= size) return items.length ? [items] : [];
  const out: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const end = Math.min(items.length, i + size);
    out.push(items.slice(i, end));
    if (end >= items.length) break;
    i = Math.max(i + 1, end - overlap);
  }
  return out;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function extractPdfText(file: File, maxPages = MAX_TEXT_PAGES): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const parts: string[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(`--- page ${i} ---\n${line}`);
  }
  return parts.join("\n");
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  const url = canvas.toDataURL("image/jpeg", quality);
  return url.split(",")[1] ?? "";
}

async function bitmapToJpeg(source: CanvasImageSource, w: number, h: number): Promise<PageImage> {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw that page.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  let quality = 0.68;
  let base64 = canvasToJpeg(canvas, quality);
  while (base64.length > TARGET_B64 && quality > 0.38) {
    quality -= 0.08;
    base64 = canvasToJpeg(canvas, quality);
  }
  if (!base64) throw new Error("Could not encode that page.");
  return { mime: "image/jpeg", base64, page: 0, width, height };
}

export async function renderPdfPages(file: File, maxPages = MAX_RENDER_PAGES): Promise<PageImage[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const pages: PageImage[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.45, MAX_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render a PDF page.");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const img = await bitmapToJpeg(canvas, canvas.width, canvas.height);
    pages.push({ ...img, page: i });
  }
  return pages;
}

export async function imageFileToPage(file: File, page: number): Promise<PageImage> {
  const bitmap = await createImageBitmap(file);
  const img = await bitmapToJpeg(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return { ...img, page };
}

export async function filesToPages(
  files: File[],
  maxPages = MAX_RENDER_PAGES,
): Promise<{
  images: PageImage[];
  text: string;
  truncated: boolean;
  pageCount: number;
  totalPages: number;
}> {
  const images: PageImage[] = [];
  const texts: string[] = [];
  let totalPages = 0;
  let truncated = false;
  for (const file of files) {
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (pdf) {
      const pdfjs = await loadPdfjs();
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      totalPages += doc.numPages;
      const textN = Math.min(doc.numPages, MAX_TEXT_PAGES);
      const renderN = Math.min(doc.numPages, Math.max(0, maxPages - images.length));
      if (doc.numPages > renderN) truncated = true;
      const parts: string[] = [];
      for (let i = 1; i <= textN; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const line = content.items
          .map((item) => ("str" in item ? String(item.str) : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (line) parts.push(`--- page ${i} ---\n${line}`);
      }
      if (parts.length) texts.push(parts.join("\n"));
      for (let i = 1; i <= renderN; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.45, MAX_EDGE / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not render a PDF page.");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const img = await bitmapToJpeg(canvas, canvas.width, canvas.height);
        images.push({ ...img, page: images.length + 1 });
      }
    } else if (file.type.startsWith("image/")) {
      totalPages += 1;
      if (images.length >= maxPages) {
        truncated = true;
        continue;
      }
      images.push(await imageFileToPage(file, images.length + 1));
    }
  }
  return {
    images,
    text: texts.join("\n\n"),
    truncated,
    pageCount: images.length,
    totalPages: Math.max(totalPages, images.length),
  };
}

export function isPdfOrImage(file: File): boolean {
  return file.type === "application/pdf" || file.type.startsWith("image/") || /\.pdf$/i.test(file.name);
}
