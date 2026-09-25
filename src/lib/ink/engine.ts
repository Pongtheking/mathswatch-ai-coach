export type InkTool = "pen" | "fineliner" | "highlighter" | "eraser";

export type InkPoint = { x: number; y: number; p: number; t: number };

export type InkStroke = {
  id: string;
  tool: InkTool;
  color: string;
  size: number;
  points: InkPoint[];
};

export type InkDoc = {
  version: 1;
  width: number;
  height: number;
  strokes: InkStroke[];
};

export const INK_COLORS = [
  { id: "ink", label: "Ink", value: "#1c1a16" },
  { id: "blue", label: "Blue", value: "#1e4b8c" },
  { id: "red", label: "Red", value: "#9b2c2c" },
] as const;

export function emptyDoc(width = 720, height = 520): InkDoc {
  return { version: 1, width, height, strokes: [] };
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pressureOf(e: PointerEvent): number {
  if (e.pointerType !== "pen") return 0.62;
  if (!e.pressure && e.buttons) return 0.55;
  return clamp(e.pressure || 0.5, 0.06, 1);
}

function widthAt(stroke: InkStroke, p: number): number {
  if (stroke.tool === "highlighter") return stroke.size * 3.4;
  if (stroke.tool === "fineliner" || stroke.tool === "eraser") return stroke.size;
  return stroke.size * (0.32 + 0.68 * p);
}

/** Midpoint quadratic smoothing — keeps handwriting, kills jitter. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  extra: InkPoint[] = [],
) {
  const pts = extra.length ? stroke.points.concat(extra) : stroke.points;
  if (pts.length === 0) return;
  const prev = ctx.globalCompositeOperation;
  const alpha = ctx.globalAlpha;
  if (stroke.tool === "highlighter") {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.32;
  } else if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length === 1) {
    const w = widthAt(stroke, pts[0].p);
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = alpha;
    return;
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    ctx.beginPath();
    ctx.lineWidth = widthAt(stroke, (a.p + b.p) / 2);
    if (i === 1) ctx.moveTo(a.x, a.y);
    else {
      const p = pts[i - 2];
      ctx.moveTo((p.x + a.x) / 2, (p.y + a.y) / 2);
    }
    ctx.quadraticCurveTo(a.x, a.y, midX, midY);
    ctx.stroke();
  }
  const last = pts[pts.length - 1];
  const prevPt = pts[pts.length - 2];
  ctx.beginPath();
  ctx.lineWidth = widthAt(stroke, last.p);
  ctx.moveTo((prevPt.x + last.x) / 2, (prevPt.y + last.y) / 2);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.globalCompositeOperation = prev;
  ctx.globalAlpha = alpha;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "squares" | "lines" | "blank",
  color: string,
) {
  if (kind === "blank") return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (kind === "squares") {
    const step = 24;
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  } else {
    const step = 28;
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function distToSeg(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function strokeHitsStroke(a: InkStroke, b: InkStroke, pad = 10): boolean {
  const ptsA = a.points;
  const ptsB = b.points;
  if (!ptsA.length || !ptsB.length) return false;
  const boxPad = Math.max(a.size, b.size) + pad;
  const aMinX = Math.min(...ptsA.map((p) => p.x)) - boxPad;
  const aMaxX = Math.max(...ptsA.map((p) => p.x)) + boxPad;
  const aMinY = Math.min(...ptsA.map((p) => p.y)) - boxPad;
  const aMaxY = Math.max(...ptsA.map((p) => p.y)) + boxPad;
  if (ptsB.every((p) => p.x < aMinX || p.x > aMaxX || p.y < aMinY || p.y > aMaxY)) {
    return false;
  }
  for (let i = 1; i < ptsA.length; i++) {
    for (let j = 1; j < ptsB.length; j++) {
      if (distToSeg(ptsA[i], ptsB[j - 1], ptsB[j]) < boxPad) return true;
      if (distToSeg(ptsB[j], ptsA[i - 1], ptsA[i]) < boxPad) return true;
    }
  }
  return false;
}

export function isScratchOut(stroke: InkStroke): boolean {
  const pts = stroke.points;
  if (pts.length < 14) return false;
  let reversals = 0;
  let dir = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    if (Math.abs(dx) < 2.2) continue;
    const nd = dx > 0 ? 1 : -1;
    if (dir && nd !== dir) reversals += 1;
    dir = nd;
  }
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const w = maxX - minX;
  const h = Math.max(1, maxY - minY);
  return reversals >= 4 && w > 22 && h < 56 && w / h > 1.5;
}

export function tryShapeAssist(stroke: InkStroke): InkStroke | null {
  const pts = stroke.points;
  if (pts.length < 8 || stroke.tool === "highlighter" || stroke.tool === "eraser") return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const span = dist(a, b);
  let maxDev = 0;
  for (const p of pts) maxDev = Math.max(maxDev, distToSeg(p, a, b));
  if (span > 36 && maxDev < 9) {
    return { ...stroke, points: [a, { ...b, p: (a.p + b.p) / 2 }] };
  }
  const closed = dist(a, b) < 30;
  if (closed && pts.length > 18) {
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    const rs = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const r = rs.reduce((s, n) => s + n, 0) / rs.length;
    const variance = rs.reduce((s, n) => s + (n - r) ** 2, 0) / rs.length;
    if (r > 16 && Math.sqrt(variance) / r < 0.16) {
      const circle: InkPoint[] = [];
      const n = 48;
      const t0 = a.t;
      for (let i = 0; i <= n; i++) {
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        circle.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
          p: 0.7,
          t: t0 + i,
        });
      }
      return { ...stroke, points: circle };
    }
  }
  return null;
}

export function rasterizeDoc(
  doc: InkDoc,
  paper: "squares" | "lines" | "blank",
  paperFill: string,
  gridColor: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.max(1, Math.round(doc.width * scale));
  canvas.height = Math.max(1, Math.round(doc.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.fillStyle = paperFill;
  ctx.fillRect(0, 0, doc.width, doc.height);
  drawGrid(ctx, doc.width, doc.height, paper, gridColor);
  for (const s of doc.strokes) drawStroke(ctx, s);
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.84): { mime: "image/jpeg"; base64: string } | null {
  const url = canvas.toDataURL("image/jpeg", quality);
  const base64 = url.split(",")[1];
  if (!base64 || base64.length < 80) return null;
  return { mime: "image/jpeg", base64 };
}
