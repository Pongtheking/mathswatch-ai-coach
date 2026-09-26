import {
  Eraser,
  Hand,
  Highlighter,
  Maximize2,
  Minimize2,
  Pencil,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  INK_COLORS,
  canvasToJpeg,
  drawGrid,
  drawStroke,
  isScratchOut,
  pressureOf,
  rasterizeDoc,
  strokeHitsStroke,
  tryShapeAssist,
  type InkDoc,
  type InkPoint,
  type InkStroke,
  type InkTool,
} from "@/lib/ink/engine";
import { cn, newId } from "@/lib/utils";

export type WorkingCanvasHandle = {
  exportImage: () => { mime: "image/jpeg"; base64: string } | null;
  isEmpty: () => boolean;
  toJSON: () => InkDoc;
  clear: () => void;
};

type PaperKind = "squares" | "lines" | "blank";

type Props = {
  className?: string;
  storageKey?: string;
  minHeight?: number;
  onInkChange?: (empty: boolean) => void;
};

type Tool = InkTool;

const SIZES = [2.2, 3.4, 5.2];

function loadDoc(key: string | undefined): InkDoc | null {
  if (!key || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const doc = JSON.parse(raw) as InkDoc;
    if (doc?.version === 1 && Array.isArray(doc.strokes)) return doc;
  } catch {
    /* ignore */
  }
  return null;
}

function saveDoc(key: string | undefined, doc: InkDoc) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(doc));
  } catch {
    /* quota */
  }
}

export const WorkingCanvas = forwardRef<WorkingCanvasHandle, Props>(function WorkingCanvas(
  { className, storageKey, minHeight = 440, onInkChange },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<InkStroke[]>([]);
  const redoStack = useRef<InkStroke[][]>([]);
  const live = useRef<InkStroke | null>(null);
  const predicted = useRef<InkPoint[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const pinch = useRef<{ d: number; panX: number; panY: number; scale: number } | null>(null);
  const view = useRef({ panX: 0, panY: 0, scale: 1 });
  const hover = useRef<{ x: number; y: number } | null>(null);
  const lastPen = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const paperH = useRef(minHeight);
  const widthRef = useRef(720);
  const raf = useRef(0);
  const drawingId = useRef<number | null>(null);
  const handlers = useRef<{
    down: (e: PointerEvent) => void;
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(INK_COLORS[0].value);
  const [size, setSize] = useState(SIZES[1]);
  const [paper, setPaper] = useState<PaperKind>("squares");
  const [fingerDraw, setFingerDraw] = useState(true);
  const [focus, setFocus] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [height, setHeight] = useState(minHeight);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const fingerRef = useRef(fingerDraw);
  const paperRefKind = useRef(paper);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;
  fingerRef.current = fingerDraw;
  paperRefKind.current = paper;
  paperH.current = height;

  const notify = useCallback(() => {
    setCanUndo(strokes.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
    onInkChange?.(strokes.current.length === 0);
    saveDoc(storageKey, {
      version: 1,
      width: widthRef.current,
      height: paperH.current,
      strokes: strokes.current,
    });
  }, [onInkChange, storageKey]);

  const paperFill = () => "#ffffff";
  const gridStroke = () => "rgba(180, 186, 194, 0.55)";

  const sizeCanvases = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(minHeight, paperH.current);
    widthRef.current = w;
    for (const canvas of [paperRef.current, inkRef.current, liveRef.current]) {
      if (!canvas) continue;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [minHeight]);

  const withView = (ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
    );
    ctx.translate(view.current.panX, view.current.panY);
    ctx.scale(view.current.scale, view.current.scale);
  };

  const paintPaper = useCallback(() => {
    const canvas = paperRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = widthRef.current;
    const h = paperH.current;
    ctx.setTransform(
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
    );
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = paperFill();
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(view.current.panX, view.current.panY);
    ctx.scale(view.current.scale, view.current.scale);
    drawGrid(ctx, widthRef.current, paperH.current, paperRefKind.current, gridStroke());
    ctx.restore();
  }, []);

  const paintInk = useCallback(() => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = widthRef.current;
    const h = paperH.current;
    ctx.setTransform(
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
    );
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    withView(ctx);
    for (const s of strokes.current) drawStroke(ctx, s);
    ctx.restore();
  }, []);

  const paintLive = useCallback(() => {
    const canvas = liveRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = widthRef.current;
    const h = paperH.current;
    ctx.setTransform(
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
      Math.min(2, window.devicePixelRatio || 1),
      0,
      0,
    );
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    withView(ctx);
    if (live.current) drawStroke(ctx, live.current, predicted.current);
    if (hover.current && !live.current) {
      ctx.beginPath();
      ctx.strokeStyle = colorRef.current;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2;
      ctx.arc(hover.current.x, hover.current.y, sizeRef.current * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }, []);

  const paintAll = useCallback(() => {
    paintPaper();
    paintInk();
    paintLive();
  }, [paintInk, paintLive, paintPaper]);

  const scheduleLive = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      paintLive();
    });
  };

  const toPaper = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.current.panX) / view.current.scale,
      y: (clientY - rect.top - view.current.panY) / view.current.scale,
    };
  };

  const growIfNeeded = (y: number) => {
    if (y < paperH.current - 88) return;
    const next = paperH.current + 220;
    paperH.current = next;
    setHeight(next);
  };

  const commitLive = (assisted?: InkStroke | null) => {
    const stroke = assisted ?? live.current;
    live.current = null;
    predicted.current = [];
    if (!stroke || stroke.points.length === 0) {
      paintLive();
      return;
    }
    if (stroke.tool === "eraser") {
      const kept = strokes.current.filter((s) => !strokeHitsStroke(stroke, s, stroke.size + 6));
      if (kept.length !== strokes.current.length) {
        redoStack.current.push(strokes.current);
        strokes.current = kept;
      }
    } else if (isScratchOut(stroke)) {
      const kept = strokes.current.filter((s) => !strokeHitsStroke(stroke, s, 14));
      if (kept.length !== strokes.current.length) {
        redoStack.current.push(strokes.current);
        strokes.current = kept;
      }
    } else {
      redoStack.current = [];
      strokes.current = [...strokes.current, stroke];
    }
    paintInk();
    paintLive();
    notify();
  };

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.add("ink-lock");
    const type = e.pointerType || "mouse";
    if (type === "pen") {
      lastPen.current = Date.now();
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type });
    try {
      wrapRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* already captured */
    }

    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinch.current = {
        d: Math.max(1, d),
        panX: view.current.panX,
        panY: view.current.panY,
        scale: view.current.scale,
      };
      live.current = null;
      drawingId.current = null;
      predicted.current = [];
      paintLive();
      return;
    }

    const otherPen = [...pointers.current.entries()].some(
      ([id, p]) => id !== e.pointerId && p.type === "pen",
    );
    if (type === "touch" && otherPen) return;
    if (type === "touch" && !fingerRef.current && Date.now() - lastPen.current < 4000) return;

    drawingId.current = e.pointerId;
    const p = toPaper(e.clientX, e.clientY);
    const stroke: InkStroke = {
      id: newId(),
      tool: toolRef.current,
      color: colorRef.current,
      size: sizeRef.current,
      points: [{ x: p.x, y: p.y, p: pressureOf(e), t: e.timeStamp }],
    };
    live.current = stroke;
    predicted.current = [];
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (!live.current) return;
      const assisted = tryShapeAssist(live.current);
      if (assisted) {
        live.current = assisted;
        scheduleLive();
      }
    }, 850);
    growIfNeeded(p.y);
    scheduleLive();
  };

  const onPointerMove = (e: PointerEvent) => {
    e.preventDefault();
    const rec = pointers.current.get(e.pointerId);
    if (rec) {
      rec.x = e.clientX;
      rec.y = e.clientY;
    }

    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const rect = wrapRef.current?.getBoundingClientRect();
      const scale = Math.min(2.4, Math.max(0.7, pinch.current.scale * (d / pinch.current.d)));
      if (rect) {
        const localX = midX - rect.left;
        const localY = midY - rect.top;
        view.current.scale = scale;
        view.current.panX = localX - ((localX - pinch.current.panX) * scale) / pinch.current.scale;
        view.current.panY = localY - ((localY - pinch.current.panY) * scale) / pinch.current.scale;
      }
      paintAll();
      return;
    }

    if (e.pointerType === "pen" && e.buttons === 0) {
      hover.current = toPaper(e.clientX, e.clientY);
      scheduleLive();
    }

    if (!live.current || drawingId.current !== e.pointerId) return;
    const coalesced = e.getCoalescedEvents?.() ?? [e];
    for (const ev of coalesced) {
      const p = toPaper(ev.clientX, ev.clientY);
      const last = live.current.points[live.current.points.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.45) continue;
      live.current.points.push({ x: p.x, y: p.y, p: pressureOf(ev), t: ev.timeStamp });
      growIfNeeded(p.y);
    }
    const preds = e.getPredictedEvents?.() ?? [];
    predicted.current = preds.map((ev) => {
      const p = toPaper(ev.clientX, ev.clientY);
      return { x: p.x, y: p.y, p: pressureOf(ev), t: ev.timeStamp };
    });
    if (holdTimer.current) {
      const pts = live.current.points;
      if (pts.length > 2) {
        const a = pts[pts.length - 1];
        const b = pts[Math.max(0, pts.length - 6)];
        if (Math.hypot(a.x - b.x, a.y - b.y) > 10) {
          window.clearTimeout(holdTimer.current);
          holdTimer.current = window.setTimeout(() => {
            if (!live.current) return;
            const assisted = tryShapeAssist(live.current);
            if (assisted) {
              live.current = assisted;
              scheduleLive();
            }
          }, 850);
        }
      }
    }
    scheduleLive();
  };

  const onPointerUp = (e: PointerEvent) => {
    e.preventDefault();
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) document.body.classList.remove("ink-lock");
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (drawingId.current === e.pointerId && live.current) {
      const assisted = tryShapeAssist(live.current);
      const pts = live.current.points;
      const still =
        pts.length > 8 &&
        Math.hypot(
          pts[pts.length - 1].x - pts[Math.max(0, pts.length - 8)].x,
          pts[pts.length - 1].y - pts[Math.max(0, pts.length - 8)].y,
        ) < 6;
      commitLive(still ? assisted : live.current);
    }
    if (drawingId.current === e.pointerId) drawingId.current = null;
    hover.current = null;
  };

  handlers.current = { down: onPointerDown, move: onPointerMove, up: onPointerUp };

  const undo = () => {
    if (!strokes.current.length) return;
    const next = strokes.current.slice(0, -1);
    redoStack.current.push(strokes.current);
    strokes.current = next;
    paintInk();
    notify();
  };

  const redo = () => {
    const prev = redoStack.current.pop();
    if (!prev) return;
    strokes.current = prev;
    paintInk();
    notify();
  };

  const clear = () => {
    if (!strokes.current.length) return;
    redoStack.current.push(strokes.current);
    strokes.current = [];
    paintInk();
    paintLive();
    notify();
  };

  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (!strokes.current.length) return null;
      const doc: InkDoc = {
        version: 1,
        width: widthRef.current,
        height: paperH.current,
        strokes: strokes.current,
      };
      const canvas = rasterizeDoc(doc, paperRefKind.current, "#ffffff", "rgba(180,186,194,0.55)");
      return canvasToJpeg(canvas);
    },
    isEmpty: () => strokes.current.length === 0,
    toJSON: () => ({
      version: 1,
      width: widthRef.current,
      height: paperH.current,
      strokes: strokes.current,
    }),
    clear,
  }));

  useEffect(() => {
    const saved = loadDoc(storageKey);
    if (saved?.strokes.length) {
      strokes.current = saved.strokes;
      paperH.current = Math.max(minHeight, saved.height);
      setHeight(paperH.current);
    }
    const id = requestAnimationFrame(() => {
      sizeCanvases();
      paintAll();
      notify();
    });
    const wrap = wrapRef.current;
    const ro = wrap ? new ResizeObserver(() => {
      sizeCanvases();
      paintAll();
    }) : null;
    if (wrap && ro) ro.observe(wrap);
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
  }, [storageKey, minHeight, sizeCanvases, paintAll, notify]);

  useEffect(() => {
    paintPaper();
  }, [paper, paintPaper]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "e" && !meta) {
        setTool("eraser");
      } else if (e.key.toLowerCase() === "p" && !meta) {
        setTool("pen");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => handlers.current?.down(e);
    const move = (e: PointerEvent) => handlers.current?.move(e);
    const up = (e: PointerEvent) => handlers.current?.up(e);
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down, { passive: false });
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", up, { passive: false });
    el.addEventListener("pointercancel", up, { passive: false });
    el.addEventListener("lostpointercapture", up, { passive: false });
    el.addEventListener("touchstart", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("gesturestart", block, { passive: false });
    el.addEventListener("contextmenu", block);
    el.addEventListener("selectstart", block);
    el.addEventListener("dragstart", block);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", up);
      el.removeEventListener("touchstart", block);
      el.removeEventListener("touchmove", block);
      el.removeEventListener("gesturestart", block);
      el.removeEventListener("contextmenu", block);
      el.removeEventListener("selectstart", block);
      el.removeEventListener("dragstart", block);
      document.body.classList.remove("ink-lock");
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const fit = () => {
      const next = Math.max(minHeight, window.innerHeight - 96);
      if (next > paperH.current) {
        paperH.current = next;
        setHeight(next);
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [focus, minHeight]);

  // A normal question page has limited vertical space on an iPad. Give a
  // touch-first pad most of the viewport from the start, rather than making a
  // student enter focus mode before there is room for a full calculation.
  useEffect(() => {
    if (focus || !window.matchMedia("(pointer: coarse)").matches) return;
    const fitTouchPad = () => {
      const next = Math.max(minHeight, Math.round(window.innerHeight * 0.64));
      if (next > paperH.current) {
        paperH.current = next;
        setHeight(next);
      }
    };
    fitTouchPad();
    window.addEventListener("resize", fitTouchPad);
    return () => window.removeEventListener("resize", fitTouchPad);
  }, [focus, minHeight]);

  return (
    <div
      className={cn(
        focus &&
          "fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]",
      )}
    >
      {focus ? (
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-sm text-fg-muted">Writing pad</p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-fg-muted hover:bg-bg-subtle"
            onClick={() => setFocus(false)}
          >
            <Minimize2 className="size-4" />
            Done
          </button>
        </div>
      ) : null}
      <div className={cn(focus && "min-h-0 flex-1 px-3 pb-[env(safe-area-inset-bottom)]")}>
        <div
          className={cn(
            "ink-shell relative overflow-hidden rounded-[18px] border border-border bg-white",
            focus && "h-full rounded-none border-0",
            className,
          )}
        >
          <div
            ref={wrapRef}
            className="ink-surface relative"
            style={{ height: focus ? "100%" : height }}
          >
            <canvas ref={paperRef} className="pointer-events-none absolute inset-0" />
            <canvas ref={inkRef} className="pointer-events-none absolute inset-0" />
            <canvas ref={liveRef} className="pointer-events-none absolute inset-0" />
          </div>

          <Toolbar
            tool={tool}
            color={color}
            size={size}
            paper={paper}
            fingerDraw={fingerDraw}
            focus={focus}
            canUndo={canUndo}
            canRedo={canRedo}
            onTool={setTool}
            onColor={setColor}
            onSize={setSize}
            onPaper={setPaper}
            onFinger={() => setFingerDraw((v) => !v)}
            onFocus={() => setFocus((v) => !v)}
            onUndo={undo}
            onRedo={redo}
            onClear={clear}
          />
        </div>
      </div>
    </div>
  );
});

function Toolbar({
  tool,
  color,
  size,
  paper,
  fingerDraw,
  focus,
  canUndo,
  canRedo,
  onTool,
  onColor,
  onSize,
  onPaper,
  onFinger,
  onFocus,
  onUndo,
  onRedo,
  onClear,
}: {
  tool: Tool;
  color: string;
  size: number;
  paper: PaperKind;
  fingerDraw: boolean;
  focus: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: Tool) => void;
  onColor: (c: string) => void;
  onSize: (n: number) => void;
  onPaper: (p: PaperKind) => void;
  onFinger: () => void;
  onFocus: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="ink-dock pointer-events-none absolute inset-x-2 bottom-2 z-10">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-bg-elevated/95 px-1.5 py-1 shadow-card backdrop-blur-md">
        <ToolBtn active={tool === "pen"} label="Fountain pen" onClick={() => onTool("pen")}>
          <Pencil className="size-4" />
        </ToolBtn>
        <ToolBtn active={tool === "fineliner"} label="Fineliner" onClick={() => onTool("fineliner")}>
          <PenLine className="size-4" />
        </ToolBtn>
        <ToolBtn active={tool === "highlighter"} label="Highlighter" onClick={() => onTool("highlighter")}>
          <Highlighter className="size-4" />
        </ToolBtn>
        <ToolBtn active={tool === "eraser"} label="Eraser" onClick={() => onTool("eraser")}>
          <Eraser className="size-4" />
        </ToolBtn>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <div className="flex shrink-0 items-center gap-1">
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              onClick={() => onColor(c.value)}
              className={cn(
                "size-7 rounded-full border transition-[transform,box-shadow] duration-150",
                color === c.value ? "scale-110 ring-2 ring-accent ring-offset-1 ring-offset-bg-elevated" : "border-border",
              )}
              style={{ background: c.value }}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 px-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Nib ${s}`}
              onClick={() => onSize(s)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full",
                size === s ? "bg-bg-subtle" : "opacity-60 hover:opacity-100",
              )}
            >
              <span className="rounded-full bg-fg" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <ToolBtn active={false} label="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="size-4" />
        </ToolBtn>
        <ToolBtn active={false} label="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="size-4" />
        </ToolBtn>
        <ToolBtn active={fingerDraw} label="Draw with finger" onClick={onFinger}>
          <Hand className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={paper === "lines"}
          label="Paper"
          onClick={() => onPaper(paper === "squares" ? "lines" : paper === "lines" ? "blank" : "squares")}
        >
          <span className="text-[10px] font-medium">{paper === "squares" ? "Sq" : paper === "lines" ? "Ln" : "—"}</span>
        </ToolBtn>
        <ToolBtn active={focus} label={focus ? "Exit focus" : "Fill the iPad"} onClick={onFocus}>
          {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </ToolBtn>
        <ToolBtn active={false} label="Clear pad" onClick={onClear}>
          <Trash2 className="size-4" />
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  label,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-muted transition-[background-color,color,transform] duration-150 ease-out",
        active ? "bg-accent/15 text-accent" : "hover:bg-bg-subtle hover:text-fg",
        disabled && "opacity-30",
      )}
    >
      {children}
    </button>
  );
}
