import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, WatchVideo, WorkingOverlay } from "@/components/ui/feedback";
import { TopicVideo } from "@/components/ui/topic-video";
import { SKILLS } from "@/lib/curriculum/data";
import { generatePracticeQuestion, getBootstrap, startPractice } from "@/lib/server/fns";

export const Route = createFileRoute("/practice")({ component: () => <Protected><PracticePage /></Protected> });

function PracticePage() {
  const nav = useNavigate();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [skillId, setSkillId] = useState("");
  const [diff, setDiff] = useState(6);

  const go = useMutation({
    mutationFn: startPractice,
    onSuccess: (res) => {
      if (!res.ok) return;
      void nav({ to: "/q/$id", params: { id: res.questionId } });
    },
  });

  const gen = useMutation({
    mutationFn: generatePracticeQuestion,
    onSuccess: (res) => {
      if (!res.ok) return;
      void nav({ to: "/q/$id", params: { id: res.questionId } });
    },
  });

  if (boot.isLoading) return <PageSkeleton rows={4} />;
  if (boot.error) {
    return (
      <ErrorBanner message={boot.error.message} onRetry={() => boot.refetch()} />
    );
  }

  const ranked = boot.data?.ranked ?? [];

  return (
    <div>
      <PageHeader
        kicker="Practice"
        title="Adaptive practice"
        lede="The coach picks the next question from your weaknesses, Grade 9 blockers and recent mistakes."
      />
      <Card>
        <CardTitle>Start practice</CardTitle>
        <CardHint>
          {ranked[0]
            ? `Recommended: ${ranked[0].name}. ${ranked[0].whyItMatters}`
            : "A diagnostic will give the coach a clearer picture."}
        </CardHint>
        <WatchVideo skillId={ranked[0]?.skillId} className="mt-2 -ml-3" />
        <Button
          className="mt-4"
          size="lg"
          disabled={go.isPending}
          onClick={() => go.mutate({ data: { mode: "adaptive" } })}
        >
          {go.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {go.isPending ? "Choosing a question…" : "Start practice"}
        </Button>
        {go.isPending ? <WorkingOverlay title="Picking the next question…" lede="Matching a skill to your current gaps." /> : null}
        {go.isError ? (
          <ErrorBanner
            className="mt-3"
            message={go.error.message}
            onRetry={() => go.mutate({ data: { mode: "adaptive" } })}
          />
        ) : null}
      </Card>

      {ranked.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No ranked skills yet"
            lede="Sit a 10-question diagnostic or capture a MathsWatch screenshot so practice has something to target."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {ranked.slice(0, 6).map((r) => (
            <Card key={r.skillId}>
              <p className="text-xs text-fg-subtle">{r.category}</p>
              <CardTitle className="text-lg">{r.name}</CardTitle>
              <p className="mt-2 text-sm text-fg-muted">{r.whyItMatters}</p>
              <p className="mt-2 text-sm tabular-nums text-fg-subtle">
                Mastery {r.mastery === null ? "—" : `${Math.round(r.mastery)}%`} · ~{r.estimatedMinutes} min
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={go.isPending}
                  onClick={() => go.mutate({ data: { skillId: r.skillId, mode: "skill" } })}
                >
                  Practise this
                </Button>
                <WatchVideo skillId={r.skillId} className="-ml-1" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardTitle>Generate a question</CardTitle>
        <CardHint>AI writes a new GCSE-style question for a skill you choose. Answers are checked before you see them.</CardHint>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="h-11 min-h-11 rounded-[10px] border border-border bg-bg px-3"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
          >
            <option value="">Choose a skill</option>
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.category} — {s.name}
              </option>
            ))}
          </select>
          <select
            className="h-11 min-h-11 rounded-[10px] border border-border bg-bg px-3"
            value={diff}
            onChange={(e) => setDiff(Number(e.target.value))}
          >
            {[4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                Target grade {n}
              </option>
            ))}
          </select>
        </div>
        <WatchVideo skillId={skillId || undefined} className="mt-2 -ml-3" />
        {skillId ? <TopicVideo skillId={skillId} className="mt-3" /> : null}
        <Button
          className="mt-3"
          variant="outline"
          disabled={!skillId || gen.isPending}
          onClick={() => gen.mutate({ data: { skillId, difficulty: diff, calculator: true } })}
        >
          {gen.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {gen.isPending ? "Generating…" : "Generate"}
        </Button>
        {gen.isPending ? <WorkingOverlay title="Writing a GCSE-style question…" /> : null}
        {gen.isError || (gen.data && !gen.data.ok) ? (
          <ErrorBanner
            className="mt-3"
            message={gen.data && !gen.data.ok ? gen.data.error : gen.error?.message}
            onRetry={() => gen.mutate({ data: { skillId, difficulty: diff, calculator: true } })}
          />
        ) : null}
      </Card>
    </div>
  );
}