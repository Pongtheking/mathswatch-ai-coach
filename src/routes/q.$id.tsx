import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkingCanvas, type WorkingCanvasHandle } from "@/components/ink/working-canvas";
import { Protected } from "@/components/layout/gate";
import { MathText } from "@/components/math/math-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { ErrorBanner, PageSkeleton, WatchVideo, WorkingOverlay } from "@/components/ui/feedback";
import { TopicVideo } from "@/components/ui/topic-video";
import { Textarea } from "@/components/ui/input";
import { compressImage } from "@/lib/image";
import { askTutor, getQuestion, startPractice, submitWorking } from "@/lib/server/fns";
import type { WorkingAnalysis } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/q/$id")({ component: () => <Protected><QuestionPage /></Protected> });

function QuestionPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const started = useRef(Date.now());
  const q = useQuery({ queryKey: ["question", id], queryFn: () => getQuestion({ data: { id } }) });
  const [working, setWorking] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [tutor, setTutor] = useState<{ mode: string; content: string } | null>(null);
  const [analysis, setAnalysis] = useState<WorkingAnalysis | null>(null);
  const [workingImg, setWorkingImg] = useState<{ mime: string; base64: string; url: string } | null>(null);
  const [padMode, setPadMode] = useState<"write" | "type" | "photo">(() =>
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? "write" : "write",
  );
  const padRef = useRef<WorkingCanvasHandle>(null);

  const [nextBusy, setNextBusy] = useState(false);

  const submit = useMutation({
    mutationFn: submitWorking,
    onSuccess: (res) => {
      if (!res.ok) {
        return;
      }
      if (res.aiError) toast.message("Working saved. AI analysis was incomplete — you can retry.");
      setAnalysis(res.analysis);
      qc.invalidateQueries({ queryKey: ["question", id] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const hint = useMutation({
    mutationFn: askTutor,
    onSuccess: (res, vars) => {
      if (!res.ok) return;
      setTutor({ mode: vars.data.mode, content: res.content });
    },
  });

  useEffect(() => {
    started.current = Date.now();
  }, [id]);

  if (q.isLoading) return <PageSkeleton rows={4} />;
  if (!q.data?.ok) {
    return (
      <ErrorBanner
        message={q.data && "error" in q.data ? q.data.error : q.error?.message}
        onRetry={() => q.refetch()}
      />
    );
  }
  const { question, image, skills } = q.data;
  const done = analysis !== null || q.data.attempts.some((a) => a.is_correct !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Attempt</p>
      <h1 className="mt-1 font-display text-3xl">Question</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.map((s) => (
          <Badge key={s.id} tone="accent">
            {s.name}
          </Badge>
        ))}
        <Badge>Grade ~{question.difficulty}</Badge>
        {question.marks ? <Badge>{question.marks} marks</Badge> : null}
        {question.calculator === false ? <Badge>Non-calculator</Badge> : null}
      </div>

      <Card className="mt-5">
        {image ? (
          <img
            src={`data:${image.mime};base64,${image.data}`}
            alt="Question"
            className="mb-4 max-h-80 rounded-lg border border-border"
          />
        ) : null}
        <MathText text={question.prompt} className="text-lg leading-relaxed" />
      </Card>

      <TopicVideo key={skills[0]?.id ?? id} skillIds={skills.map((s) => s.id)} />

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["explain", "Explain"],
            ["hint", "Hint"],
            ["stronger_hint", "Stronger hint"],
            ["method", "Show method"],
            ["solution", "Full solution"],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            size="sm"
            variant={mode === "solution" ? "outline" : "ghost"}
            disabled={hint.isPending}
            onClick={() =>
              hint.mutate({ data: { questionId: id, mode, workingText: working } })
            }
          >
            {hint.isPending && hint.variables?.data.mode === mode ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {label}
          </Button>
        ))}
      </div>
      {hint.isPending ? <WorkingOverlay title="Coach is thinking…" lede="A short hint, not the answer." /> : null}
      {hint.isError || (hint.data && !hint.data.ok) ? (
        <ErrorBanner
          className="mt-3"
          message={hint.data && "error" in hint.data ? hint.data.error : hint.error?.message}
          onRetry={() => hint.reset()}
        />
      ) : null}
      {tutor ? (
        <Card className="mt-3 page-enter">
          <p className="text-xs uppercase tracking-wider text-fg-subtle">{tutor.mode.replace("_", " ")}</p>
          <MathText className="mt-2 prose-like text-sm leading-relaxed" text={tutor.content} />
          <WatchVideo skillIds={skills.map((s) => s.id)} className="mt-2 -ml-3" />
        </Card>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">Attempt it first. Hints stay small until you ask for more.</p>
      )}

      <Card className="mt-4 select-none">
        <CardTitle className="text-lg">Your working</CardTitle>
        <CardHint>
          Write it as you would in the exam. Apple Pencil is first-class — pressure, palm rejection, scratch-out to erase.
        </CardHint>
        <div className="mt-3 flex rounded-full border border-border bg-bg p-1">
          {(
            [
              ["write", "Write"],
              ["type", "Type"],
              ["photo", "Photo"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPadMode(mode)}
              className={cn(
                "min-h-10 flex-1 rounded-full px-3 text-sm transition-colors duration-150",
                padMode === mode ? "bg-bg-elevated text-fg shadow-card" : "text-fg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {padMode === "write" ? (
          <div className="mt-3">
            <WorkingCanvas ref={padRef} storageKey={`working-${id}`} minHeight={480} />
          </div>
        ) : null}
        {padMode === "type" ? (
          <Textarea
            className="mt-3 font-mono text-sm"
            placeholder="Write every step. The coach looks for the earliest error, not just the final line."
            value={working}
            onChange={(e) => setWorking(e.target.value)}
          />
        ) : null}
        {padMode === "photo" ? (
          <div className="mt-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                const el = document.createElement("input");
                el.type = "file";
                el.accept = "image/*";
                el.onchange = async () => {
                  const f = el.files?.[0];
                  if (!f) return;
                  const c = await compressImage(f);
                  setWorkingImg({ ...c, url: URL.createObjectURL(f) });
                };
                el.click();
              }}
            >
              Upload working photo
            </Button>
            {workingImg ? (
              <img src={workingImg.url} alt="Your working" className="mt-3 max-h-48 rounded-lg border border-border" />
            ) : (
              <p className="mt-2 text-sm text-fg-subtle">Paper photo if you already wrote it elsewhere.</p>
            )}
          </div>
        ) : null}
        <div className="mt-4">
          <p className="text-xs text-fg-muted">Confidence</p>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConfidence(n)}
                className={`size-10 rounded-md border text-sm ${confidence === n ? "border-accent bg-accent/15" : "border-border"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="mt-4"
          size="lg"
          disabled={submit.isPending}
          onClick={() => {
            const ink = padMode === "write" ? padRef.current?.exportImage() : null;
            const img = ink ?? (padMode === "photo" ? workingImg : null);
            submit.mutate({
              data: {
                questionId: id,
                workingText: working,
                imageMime: img?.mime,
                imageBase64: img?.base64,
                confidence,
                timeMs: Date.now() - started.current,
              },
            });
          }}
        >
          {submit.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Checking working…
            </>
          ) : (
            "Check my working"
          )}
        </Button>
        {submit.isPending ? (
          <WorkingOverlay title="Checking your working…" lede="Looking for the first slip, not just the last line." />
        ) : null}
        {submit.isError || (submit.data && !submit.data.ok) ? (
          <ErrorBanner
            className="mt-3"
            message={submit.data && "error" in submit.data ? submit.data.error : submit.error?.message}
            onRetry={() => {
              const ink = padMode === "write" ? padRef.current?.exportImage() : null;
              const img = ink ?? (padMode === "photo" ? workingImg : null);
              submit.mutate({
                data: {
                  questionId: id,
                  workingText: working,
                  imageMime: img?.mime,
                  imageBase64: img?.base64,
                  confidence,
                  timeMs: Date.now() - started.current,
                },
              });
            }}
          />
        ) : null}
      </Card>

      {analysis ? (
        <Card className={cn("mt-4", analysis.is_correct ? "pop-ok" : "shake-once")}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={analysis.is_correct ? "ok" : "danger"}>
              {analysis.is_correct ? "Correct" : "Error detected"}
            </Badge>
            {analysis.is_correct ? <span className="text-sm text-ok">Well marked.</span> : null}
          </div>
          {analysis.praise ? <p className="mt-3 text-sm text-fg-muted">{analysis.praise}</p> : null}
          <p className="mt-3 leading-relaxed">{analysis.feedback}</p>
          {analysis.mistakes.map((m, i) => (
            <div key={i} className="mt-4 rounded-lg bg-bg-subtle p-4">
              <p className="text-xs uppercase tracking-wider text-fg-subtle">{m.category}</p>
              <p className="mt-2 text-sm">
                <strong>You did:</strong> {m.what_student_did}
              </p>
              <p className="mt-1 text-sm">
                <strong>Should have:</strong> {m.what_should_happen}
              </p>
              <p className="mt-1 text-sm">
                <strong>Why:</strong> {m.why_wrong}
              </p>
              <p className="mt-1 text-sm">
                <strong>Next time:</strong> {m.how_to_avoid}
              </p>
              <WatchVideo skillIds={skills.map((s) => s.id)} className="mt-2 -ml-3" />
            </div>
          ))}
          {analysis.steps.length > 0 ? (
            <ol className="mt-4 space-y-2">
              {analysis.steps.map((s) => (
                <li key={s.n} className="flex gap-2 text-sm">
                  <Badge tone={s.ok ? "ok" : "danger"}>{s.n}</Badge>
                  <span>
                    {s.text} {s.note ? <span className="text-fg-muted">— {s.note}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      ) : null}

      {done ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={nextBusy}
            onClick={async () => {
              setNextBusy(true);
              try {
                const next = await startPractice({ data: { skillId: skills[0]?.id, mode: "adaptive" } });
                if (next.ok) void nav({ to: "/q/$id", params: { id: next.questionId } });
                else toast.error("Could not pick a similar question.");
              } finally {
                setNextBusy(false);
              }
            }}
          >
            {nextBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            {nextBusy ? "Picking the next one…" : "Practise a similar question"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
