import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkingCanvas } from "@/components/ink/working-canvas";
import { EstimateDisclaimer } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ErrorBanner, PageSkeleton, WatchVideo, WorkingOverlay } from "@/components/ui/feedback";
import { TopicVideo } from "@/components/ui/topic-video";
import { Textarea } from "@/components/ui/input";
import { completeTest, getTest, saveTestAnswer } from "@/lib/server/fns";
import { parseJson } from "@/lib/utils";

export const Route = createFileRoute("/exam/$id")({ component: () => <Protected><ExamPage /></Protected> });

function ExamPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["test", id], queryFn: () => getTest({ data: { id } }) });
  const [idx, setIdx] = useState(0);
  const [review, setReview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!q.data?.ok) return;
    const map: Record<string, string> = {};
    const fl: Record<string, boolean> = {};
    for (const a of q.data.answers) {
      map[a.question_id] = a.response ?? "";
      fl[a.question_id] = a.flagged;
    }
    setAnswers(map);
    setFlags(fl);
    if (q.data.test.timed && q.data.test.time_limit_s && q.data.test.status === "active") {
      const start = new Date(q.data.test.started_at).getTime();
      setRemaining(Math.max(0, q.data.test.time_limit_s - Math.floor((Date.now() - start) / 1000)));
    }
  }, [q.data]);

  const timerRunning = remaining !== null && remaining > 0;

  useEffect(() => {
    if (!timerRunning) return;
    const t = window.setInterval(() => setRemaining((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(t);
  }, [timerRunning]);

  const submit = useMutation({
    mutationFn: completeTest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test", id] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Paper marked");
    },
  });

  const data = q.data;
  const questions = data?.ok ? data.questions : [];
  const current = questions[idx];
  const test = data?.ok ? data.test : null;
  const analysis = test?.analysis_json ? parseJson<{ score: number; max: number; accuracy: number; topicsLost: { skill: string; marks: number }[]; note: string }>(test.analysis_json, { score: 0, max: 0, accuracy: 0, topicsLost: [], note: "" }) : null;

  const clock = useMemo(() => {
    if (remaining === null) return null;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [remaining]);

  if (q.isLoading) return <PageSkeleton rows={3} />;
  if (!data?.ok) {
    return (
      <ErrorBanner
        message={data && "error" in data ? data.error : q.error?.message ?? "Test not found."}
        onRetry={() => q.refetch()}
      />
    );
  }

  if (test?.status === "completed" && analysis) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">{test.title}</p>
        <h1 className="font-display text-4xl">Results</h1>
        <Card className="mt-4">
          <p className="font-display text-5xl tabular-nums">
            {analysis.score}/{analysis.max}
          </p>
          <p className="mt-1 text-fg-muted">Accuracy {analysis.accuracy}%</p>
          <p className="mt-3 text-sm text-fg-subtle">{analysis.note}</p>
        </Card>
        {analysis.topicsLost.length > 0 ? (
          <Card className="mt-4">
            <CardTitle>Marks dropped on</CardTitle>
            <ul className="mt-3 space-y-2">
              {analysis.topicsLost.map((t) => (
                <li key={t.skill} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{t.skill}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{t.marks} marks</span>
                    <WatchVideo skillName={t.skill} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Button className="mt-4" asChild>
          <Link to="/plan">Recommended revision</Link>
        </Button>
        <EstimateDisclaimer />
      </div>
    );
  }

  if (review) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl">Review</h1>
        <ul className="mt-4 space-y-2">
          {questions.map((qq, i) => (
            <li key={qq.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left"
                onClick={() => {
                  setIdx(i);
                  setReview(false);
                }}
              >
                <span>Q{i + 1} {flags[qq.id] ? "(flagged)" : ""}</span>
                <span className="text-sm text-fg-muted">{answers[qq.id]?.trim() ? "Answered" : "Blank"}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button className="mt-4" disabled={submit.isPending} onClick={() => submit.mutate({ data: { testId: id } })}>
          {submit.isPending ? "Marking…" : "Submit paper"}
        </Button>
        {submit.isPending ? <WorkingOverlay title="Marking the paper…" lede="Applying method marks and updating mastery." /> : null}
        {submit.isError ? (
          <ErrorBanner className="mt-3" message={submit.error.message} onRetry={() => submit.mutate({ data: { testId: id } })} />
        ) : null}
      </div>
    );
  }

  if (!current) return <p>No questions.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {test?.title} · Q{idx + 1}/{questions.length} · {current.marks} mark{current.marks === 1 ? "" : "s"}
        </p>
        {clock ? <span className={`tabular-nums ${remaining !== null && remaining < 60 ? "text-danger" : ""}`}>{clock}</span> : null}
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            type="button"
            onClick={() => setIdx(i)}
            className={`size-11 min-h-11 rounded-md text-xs ${i === idx ? "bg-primary text-primary-fg" : answers[qq.id] ? "bg-bg-subtle" : "border border-border"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <Card key={current.id} className="page-enter">
        <MathText text={current.prompt} className="text-lg" />
        <TopicVideo skillIds={current.skillIds} collapsed />
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Working pad</p>
        <div className="mt-2">
          <WorkingCanvas
            className="select-none"
            storageKey={`exam-${id}-${current.id}`}
            minHeight={600}
            focusQuestion={<MathText text={current.prompt} />}
          />
        </div>
        <Textarea
          className="mt-4"
          value={answers[current.id] ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setAnswers((a) => ({ ...a, [current.id]: v }));
          }}
          onBlur={() =>
            saveTestAnswer({
              data: { testId: id, questionId: current.id, response: answers[current.id] ?? "" },
            }).catch(() => toast.error("Could not save answer"))
          }
          placeholder="Final answer (and any typed working)"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const next = !flags[current.id];
              setFlags((f) => ({ ...f, [current.id]: next }));
              void saveTestAnswer({ data: { testId: id, questionId: current.id, flagged: next } });
            }}
          >
            <Flag className="size-4" /> {flags[current.id] ? "Unflag" : "Flag"}
          </Button>
          <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <Button variant="ghost" disabled={idx >= questions.length - 1} onClick={() => setIdx((i) => i + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
          <Button onClick={() => setReview(true)}>Review paper</Button>
        </div>
      </Card>
      {remaining === 0 ? (
        <p className="mt-3 text-sm text-danger">Time is up. Review and submit.</p>
      ) : null}
    </div>
  );
}
