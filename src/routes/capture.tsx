import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Type } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { ErrorBanner, EmptyState, NeedKeyBanner, WorkingOverlay } from "@/components/ui/feedback";
import { AiKeyForm } from "@/components/ai-key-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { compressImage, fileFromClipboard } from "@/lib/image";
import { captureQuestion, confirmQuestion, getBootstrap, listRecentQuestions } from "@/lib/server/fns";

export const Route = createFileRoute("/capture")({ component: () => <Protected><CapturePage /></Protected> });

function CapturePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [typed, setTyped] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof captureQuestion>> | null>(null);
  const recent = useQuery({ queryKey: ["recent-q"], queryFn: () => listRecentQuestions() });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const hasKey = Boolean(boot.data?.aiAvailable);

  const mut = useMutation({
    mutationFn: (input: { mime: string; base64: string; typedText?: string }) =>
      captureQuestion({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) {
        return;
      }
      setPending(res);
      qc.invalidateQueries({ queryKey: ["recent-q"] });
    },
  });

  const runFile = useCallback(async (file: File) => {
    if (!hasKey) {
      toast.error("Add a real Gemini API key before capturing.");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      setPreview(url);
      const { mime, base64 } = await compressImage(file);
      mut.mutate({ mime, base64 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read image");
    }
  }, [mut, hasKey]);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = fileFromClipboard(e.nativeEvent);
      if (file) {
        e.preventDefault();
        void runFile(file);
      }
    },
    [runFile],
  );

  return (
    <div onPaste={onPaste}>
      <PageHeader
        kicker="Capture"
        title="Capture a question"
        lede="Screenshot from MathsWatch, photo, paste, or type it. The coach reads the question — it will not give the answer yet."
      />

      {!hasKey && !boot.isLoading ? (
        <div className="mb-4 space-y-3">
          <NeedKeyBanner />
          <AiKeyForm />
        </div>
      ) : null}

      {pending && pending.ok ? (
        <Card className="mb-4">
          <CardTitle>Check this is right</CardTitle>
          <CardHint>If the reading looks off, edit before you attempt it. The answer is hidden.</CardHint>
          <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed">{pending.analysis.question_text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="accent">{pending.analysis.topic}</Badge>
            <Badge>Grade ~{pending.analysis.estimated_grade}</Badge>
            <Badge>{pending.analysis.question_type}</Badge>
            {pending.analysis.marks ? <Badge>{pending.analysis.marks} marks</Badge> : null}
          </div>
          {pending.analysis.notes ? <p className="mt-3 text-sm text-fg-muted">{pending.analysis.notes}</p> : null}
          <p className="mt-2 text-xs text-fg-subtle">
            Confidence {Math.round(pending.analysis.confidence * 100)}%. Confirm rather than inventing.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await confirmQuestion({ data: { questionId: pending.questionId } });
                void nav({ to: "/q/$id", params: { id: pending.questionId } });
              }}
            >
              Looks right — attempt
            </Button>
            <Button variant="outline" onClick={() => setPending(null)}>
              Capture again
            </Button>
          </div>
        </Card>
      ) : null}

      <Card
        className={drag ? "border-accent" : ""}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files[0];
          if (file) void runFile(file);
        }}
      >
        <div className="flex flex-col items-center py-6 text-center">
          <Camera className="size-8 text-fg-muted" />
          <p className="mt-3 font-display text-2xl">Drop a screenshot</p>
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            Camera, files, drag and drop, or paste from the clipboard. PNG, JPEG or WebP.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => inputRef.current?.click()} disabled={mut.isPending || !hasKey}>
              {mut.isPending ? "Reading question…" : "Capture question"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                const el = document.createElement("input");
                el.type = "file";
                el.accept = "image/*";
                el.capture = "environment";
                el.onchange = () => {
                  const f = el.files?.[0];
                  if (f) void runFile(f);
                };
                el.click();
              }}
            >
              Use camera
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runFile(f);
            }}
          />
          {preview ? (
            <img src={preview} alt="Question screenshot" className="mt-6 max-h-64 w-full rounded-lg border border-border object-contain" />
          ) : null}
          {mut.isPending ? (
            <WorkingOverlay title="Reading the question…" lede="The answer stays hidden until you attempt it." />
          ) : null}
          {mut.isError || (mut.data && !mut.data.ok) ? (
            <ErrorBanner
              className="mt-4 text-left"
              message={mut.data && "error" in mut.data ? mut.data.error : mut.error?.message}
              onRetry={() => mut.reset()}
            />
          ) : null}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center gap-2">
          <Type className="size-4 text-fg-muted" />
          <CardTitle className="text-lg">Or type the question</CardTitle>
        </div>
        <Textarea
          className="mt-3"
          placeholder="e.g. Solve 3x + 5 = 20"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button
          className="mt-3"
          variant="outline"
          disabled={!typed.trim() || mut.isPending || !hasKey}
          onClick={() => mut.mutate({ mime: "text/plain", base64: "", typedText: typed })}
        >
          Analyse typed question
        </Button>
      </Card>

      {recent.data && recent.data.length > 0 ? (
        <div className="mt-6">
          <h2 className="font-display text-xl">Question history</h2>
          <ul className="mt-3 space-y-2">
            {recent.data.map((row) => (
              <li key={row.id}>
                <Link
                  to="/q/$id"
                  params={{ id: row.id }}
                  className="block min-h-12 rounded-lg border border-border bg-bg-elevated px-4 py-3 hover:bg-bg-subtle"
                >
                  <p className="line-clamp-2 text-sm">{row.prompt}</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {row.source} · grade ~{row.difficulty}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No questions captured yet"
            lede="Drop a MathsWatch screenshot, use the camera, or type a question to start the loop."
          />
        </div>
      )}
    </div>
  );
}
