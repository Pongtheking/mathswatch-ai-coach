import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { ProgressBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, PracticeCta, WatchVideo } from "@/components/ui/feedback";
import { getGrade9, startPractice } from "@/lib/server/fns";

export const Route = createFileRoute("/grade-9")({ component: () => <Protected><Grade9Page /></Protected> });

function confLabel(c: string) {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium confidence";
  if (c === "low") return "Low confidence";
  return "Too early to estimate";
}

function Grade9Page() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["grade9"], queryFn: () => getGrade9() });
  const go = useMutation({
    mutationFn: startPractice,
    onSuccess: (res) => {
      if (res.ok) void nav({ to: "/q/$id", params: { id: res.questionId } });
    },
  });
  if (q.isLoading) return <PageSkeleton />;
  if (!q.data) {
    return (
      <ErrorBanner
        message={q.error?.message ?? "Could not load gap analysis."}
        onRetry={() => q.refetch()}
      />
    );
  }
  const {
    estimate,
    target,
    blockers,
    assessed,
    confidence,
    coverage,
    pathToNine,
    higherReady,
    algebraReady,
    bandLow,
    bandHigh,
    whyNotNine,
    strands,
  } = q.data;
  const gap = estimate === null ? null : Math.max(0, target - estimate);

  return (
    <div>
      <PageHeader
        kicker="Grade 9 gap"
        title="What still stands between you and 9"
        lede="This is a conservative internal estimate. Unseen higher-tier skills count as weak, so the number cannot inflate from a few easy topics."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-fg-subtle">Current estimate</p>
          <p className="font-display text-4xl tabular-nums">{estimate ?? "—"}</p>
          <p className="mt-1 text-xs text-fg-subtle">
            {bandLow != null && bandHigh != null ? `Likely band ${bandLow.toFixed(1)}–${bandHigh.toFixed(1)}` : "Need more evidence"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-fg-subtle">Path to 9</p>
          <p className="font-display text-4xl tabular-nums">{pathToNine}%</p>
          <ProgressBar className="mt-3" value={pathToNine} />
        </Card>
        <Card>
          <p className="text-xs text-fg-subtle">Gap to {target}</p>
          <p className="font-display text-4xl tabular-nums">{gap === null ? "—" : gap.toFixed(1)}</p>
          <p className="text-xs text-fg-subtle">{confLabel(confidence)} · {assessed} skills assessed · {coverage}% coverage</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-xs text-fg-subtle">Higher-tier readiness</p>
          <p className="font-display text-2xl tabular-nums">{higherReady}%</p>
          <ProgressBar className="mt-2" value={higherReady} />
          <p className="mt-2 text-xs text-fg-subtle">Grade 8–9 skills. Unseen topics count as 18%.</p>
        </Card>
        <Card>
          <p className="text-xs text-fg-subtle">Algebra bottleneck</p>
          <p className="font-display text-2xl tabular-nums">{algebraReady}%</p>
          <ProgressBar className="mt-2" value={algebraReady} />
          <p className="mt-2 text-xs text-fg-subtle">A 9 is rare without strong algebra.</p>
        </Card>
      </div>

      {whyNotNine.length > 0 ? (
        <Card className="mt-4">
          <CardTitle className="text-lg">Why this is not a 9 yet</CardTitle>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-muted">
            {whyNotNine.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {strands.length > 0 ? (
        <>
          <h2 className="mt-8 font-display text-2xl">Strands</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {strands.map((s) => (
              <Card key={s.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                  <p className="tabular-nums text-sm text-fg-muted">
                    {s.avg === null ? "unassessed" : `${Math.round(s.avg)}%`}
                  </p>
                </div>
                <ProgressBar className="mt-2" value={s.avg ?? 0} />
                <p className="mt-2 text-xs text-fg-subtle">{s.assessed}/{s.total} skills with evidence</p>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="mt-8 font-display text-2xl">Biggest blockers</h2>
      <div className="mt-3 space-y-3">
        {blockers.length === 0 ? (
          <EmptyState
            title="No Grade 9 blockers mapped yet"
            lede="Sit a diagnostic or practise a few higher-tier questions so the gap analysis has evidence."
            action={<PracticeCta />}
          />
        ) : (
          blockers.map((b, i) => (
          <Card key={b.skillId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-fg-subtle">{i + 1}. {b.category}</p>
                <CardTitle className="text-xl">{b.name}</CardTitle>
              </div>
              <p className="tabular-nums text-sm text-fg-muted">
                {b.mastery === null ? "unassessed" : `${Math.round(b.mastery)}%`} → {b.targetMastery}%
              </p>
            </div>
            <ProgressBar className="mt-3" value={b.mastery ?? 0} />
            <p className="mt-3 text-sm text-fg-muted">{b.whyItMatters}</p>
            {b.prerequisites.length > 0 ? (
              <p className="mt-2 text-xs text-fg-subtle">Prerequisites: {b.prerequisites.join(", ")}</p>
            ) : null}
            <p className="mt-1 text-xs text-fg-subtle">Estimated effort ~{b.effortHours} focused hours</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={go.isPending} onClick={() => go.mutate({ data: { skillId: b.skillId, mode: "skill" } })}>
                {go.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Practise this
              </Button>
              <WatchVideo skillId={b.skillId} />
            </div>
          </Card>
          ))
        )}
      </div>
      <EstimateDisclaimer />
    </div>
  );
}
