import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileText, Loader2, Repeat2, ScanSearch, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, NeedKeyBanner, WorkingOverlay } from "@/components/ui/feedback";
import { AiKeyForm } from "@/components/ai-key-form";
import { classifyPair, chunkPages, filesToPages, isPdfOrImage, type PageImage } from "@/lib/pdf";
import { listMarkedPapers, markPaper } from "@/lib/server/papers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marker")({
  component: () => (
    <Protected>
      <MarkerPage />
    </Protected>
  ),
});

type Slot = {
  files: File[];
  images: PageImage[];
  text: string;
  truncated: boolean;
  reading: boolean;
  totalPages: number;
};

const emptySlot = (): Slot => ({
  files: [],
  images: [],
  text: "",
  truncated: false,
  reading: false,
  totalPages: 0,
});

function MarkerPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["papers"], queryFn: () => listMarkedPapers() });
  const [paper, setPaper] = useState<Slot>(emptySlot);
  const [scheme, setScheme] = useState<Slot>(emptySlot);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [hint, setHint] = useState("Drop your completed paper and the official mark scheme.");

  const mut = useMutation({
    mutationFn: async (input: {
      confirmed: boolean;
      title: string;
      paperImages: PageImage[];
      schemeImages: PageImage[];
      paperText: string;
      schemeText: string;
    }) => {
      const schemeImages = input.schemeImages.slice(0, 24);
      const batches = chunkPages(input.paperImages);
      const work = batches.length ? batches : [[] as PageImage[]];
      let paperId: string | undefined;
      let last: Awaited<ReturnType<typeof markPaper>> | undefined;
      for (let i = 0; i < work.length; i++) {
        const from = work[i][0]?.page ?? i * 8 + 1;
        const to = work[i][work[i].length - 1]?.page ?? from;
        setStage(
          work.length === 1
            ? "Reading the mark scheme, then marking your script…"
            : `Marking pages ${from}–${to} of ${input.paperImages.length} (whole paper, batch ${i + 1} of ${work.length})…`,
        );
        last = await markPaper({
          data: {
            confirmed: input.confirmed,
            title: input.title,
            paperId,
            lastBatch: i === work.length - 1,
            batchIndex: i,
            batchCount: work.length,
            paperImages: work[i],
            schemeImages: i === 0 ? schemeImages : [],
            paperText: i === 0 ? input.paperText : undefined,
            schemeText: i === 0 ? input.schemeText : undefined,
          },
        });
        if (!last.ok) return last;
        paperId = last.paperId;
      }
      return last!;
    },
    onSuccess: (res) => {
      setStage(null);
      if (!res.ok) {
        return;
      }
      qc.invalidateQueries({ queryKey: ["papers"] });
      void nav({ to: "/marker/$id", params: { id: res.paperId } });
    },
    onError: () => {
      setStage(null);
    },
  });

  const ready = (paper.images.length > 0 || paper.text.length > 40) && (scheme.images.length > 0 || scheme.text.length > 40);

  const hasKey = Boolean(history.data?.aiAvailable);

  const onMark = () => {
    if (!hasKey) {
      toast.error("Add a real Gemini API key before marking.");
      document.getElementById("ai-key")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!confirmed) {
      toast.error("Tick the confirmation first.");
      return;
    }
    if (!ready) {
      toast.error("Upload both your paper and the mark scheme.");
      return;
    }
    setStage("Reading the mark scheme, then marking your script…");
    mut.mutate({
      confirmed: true,
      title: paper.files[0]?.name.replace(/\.pdf$/i, "") || "Marked paper",
      paperImages: paper.images,
      schemeImages: scheme.images,
      paperText: paper.text,
      schemeText: scheme.text,
    });
  };

  const swap = () => {
    setPaper(scheme);
    setScheme(paper);
    setHint("Swapped. Check the two slots before marking.");
  };

  return (
    <div>
      <PageHeader
        kicker="AI Paper Marker"
        title="Mark a completed paper"
        lede="Upload the paper you sat and the official mark scheme. The coach marks to the scheme — method marks, follow-through, alternatives — then tells you where the marks went."
      />

      <Card className="border-accent/25">
        <CardTitle>Upload your paper and mark scheme</CardTitle>
        <CardHint>
          Two files: your completed script, then the official mark scheme. The whole paper is marked in page batches — including long GCSE scripts.
        </CardHint>

        {!hasKey && !history.isLoading ? (
          <div className="mt-4 space-y-3">
            <NeedKeyBanner />
            <AiKeyForm compact />
          </div>
        ) : null}

        <CombinedDrop
          disabled={mut.isPending}
          onFiles={async (files) => {
            const usable = files.filter(isPdfOrImage);
            if (!usable.length) {
              toast.error("Use PDFs or photos.");
              return;
            }
            if (usable.length === 1) {
              if (!paper.files.length) await fillSlot(usable, setPaper);
              else await fillSlot(usable, setScheme);
              return;
            }
            const a = usable[0];
            const b = usable[1];
            setPaper((s) => ({ ...s, reading: true }));
            setScheme((s) => ({ ...s, reading: true }));
            try {
              const [pa, pb] = await Promise.all([filesToPages([a]), filesToPages([b])]);
              const guess = classifyPair(
                { name: a.name, text: pa.text },
                { name: b.name, text: pb.text },
              );
              const first = { files: [a], images: pa.images, text: pa.text, truncated: pa.truncated, reading: false, totalPages: pa.totalPages };
              const second = { files: [b], images: pb.images, text: pb.text, truncated: pb.truncated, reading: false, totalPages: pb.totalPages };
              if (guess.paperFirst) {
                setPaper(first);
                setScheme(second);
              } else {
                setPaper(second);
                setScheme(first);
              }
              setHint(guess.reason);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not read those files.");
              setPaper(emptySlot());
              setScheme(emptySlot());
            }
          }}
        />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FileSlot
            id="marker-paper-files"
            label="Your completed paper"
            hint="The script you wrote on"
            slot={paper}
            onFiles={(files) => void fillSlot(files, setPaper)}
            disabled={mut.isPending}
          />
          <FileSlot
            id="marker-scheme-files"
            label="Official mark scheme"
            hint="From the same exam series"
            slot={scheme}
            onFiles={(files) => void fillSlot(files, setScheme)}
            disabled={mut.isPending}
          />
        </div>

        {(paper.files.length > 0 || scheme.files.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={swap} disabled={mut.isPending}>
              <Repeat2 className="size-4" />
              Swap files
            </Button>
            <p className="text-sm text-fg-muted">{hint}</p>
          </div>
        )}

        {paper.truncated || scheme.truncated ? (
          <p className="mt-3 text-sm text-warn">
            {paper.truncated
              ? `Your script has ${paper.totalPages} pages; the first ${paper.images.length} are sent as images and the rest as text.`
              : `The mark scheme has ${scheme.totalPages} pages; the first ${scheme.images.length} are sent as images and the rest as text.`}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-fg-muted">
          Upload the official mark scheme too, so marks and feedback follow the real M1 / A1 / B1 rules — not a guessed answer key.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="text-sm text-fg-muted">
            I confirm that uploading these materials, and marking them with this AI coach, does not breach copyright,
            licence terms, exam-board rules, school policies, or confidentiality. I am responsible for what I upload.
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-subtle">
            This is an internal mark, not an official exam-board result.
          </p>
          <Button
            size="lg"
            className="min-h-12 rounded-full px-6"
            disabled={mut.isPending || !ready || !confirmed || !hasKey}
            onClick={onMark}
          >
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
            {mut.isPending ? "Marking…" : "Mark paper"}
            {!mut.isPending ? <ArrowRight className="size-4" /> : null}
          </Button>
        </div>

        {stage || mut.isPending ? (
          <WorkingOverlay
            title={stage || "Marking your paper…"}
            lede="Reading the scheme, then awarding method and accuracy marks across the whole paper. Stay on this screen while batches run."
          />
        ) : null}
        {mut.isError || (mut.data && !mut.data.ok) ? (
          <ErrorBanner
            className="mt-3"
            message={mut.data && "error" in mut.data ? mut.data.error : mut.error?.message}
            onRetry={onMark}
          />
        ) : null}
      </Card>

      {history.isLoading ? (
        <div className="mt-6 h-28 animate-pulse rounded-xl bg-bg-subtle" />
      ) : history.data && history.data.papers.length > 0 ? (
        <Card className="mt-6">
          <CardTitle>Marked papers</CardTitle>
          <ul className="mt-3 divide-y divide-border">
            {history.data.papers.map((p) => (
              <li key={p.id}>
                <Link
                  to="/marker/$id"
                  params={{ id: p.id }}
                  className="flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  <span>
                    {p.title} <Badge className="ml-2">{p.status}</Badge>
                  </span>
                  <span className="tabular-nums text-sm text-fg-muted">
                    {p.total_awarded != null && p.total_available != null
                      ? `${p.total_awarded}/${p.total_available}`
                      : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No papers marked yet"
            lede="Upload the script you sat plus the official mark scheme. Marks follow M1 / A1 / B1, not a guessed key."
          />
        </div>
      )}

      <EstimateDisclaimer />
    </div>
  );
}

async function fillSlot(files: File[], set: (fn: (s: Slot) => Slot) => void) {
  const usable = files.filter(isPdfOrImage);
  if (!usable.length) {
    toast.error("Use PDFs or photos.");
    return;
  }
  set((s) => ({ ...s, reading: true }));
  try {
    const result = await filesToPages(usable);
    set(() => ({
      files: usable,
      images: result.images,
      text: result.text,
      truncated: result.truncated,
      reading: false,
      totalPages: result.totalPages,
    }));
  } catch (err) {
    set((s) => ({ ...s, reading: false }));
    toast.error(err instanceof Error ? err.message : "Could not read that file.");
  }
}

function CombinedDrop({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        id="marker-combined-files"
        data-testid="marker-combined-files"
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles([...e.dataTransfer.files]);
      }}
      className={cn(
        "mt-5 flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center",
        over ? "border-accent bg-accent/10" : "border-border bg-bg",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
      )}
    >
      <Upload className="size-8 text-fg-subtle" />
      <p className="mt-3 font-medium">Upload your paper and its mark scheme (2 PDFs)</p>
      <p className="mt-1 text-sm text-fg-subtle">or drag & drop them here</p>
    </div>
    </>
  );
}

function FileSlot({
  id,
  label,
  hint,
  slot,
  onFiles,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  slot: Slot;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const name = useMemo(() => slot.files.map((f) => f.name).join(", "), [slot.files]);
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-fg-subtle">{hint}</p>
      {slot.reading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
          <Loader2 className="size-4 animate-spin" /> Reading pages…
        </p>
      ) : slot.files.length ? (
        <p className="mt-3 flex items-start gap-2 text-sm">
          <FileText className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            {name}
            <span className="mt-0.5 block text-xs text-fg-subtle">
              {slot.totalPages > slot.images.length
                ? `${slot.images.length} of ${slot.totalPages} pages as images`
                : `${slot.images.length} page${slot.images.length === 1 ? "" : "s"} ready`}
            </span>
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-fg-subtle">Nothing chosen yet</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => photoRef.current?.click()}>
          Take photo
        </Button>
      </div>
      <input
        ref={inputRef}
        id={id}
        data-testid={id}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <input
        ref={photoRef}
        id={`${id}-photo`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
