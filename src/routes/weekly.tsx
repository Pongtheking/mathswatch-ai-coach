import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, PracticeCta } from "@/components/ui/feedback";
import { getWeeklyReview } from "@/lib/server/fns";

export const Route = createFileRoute("/weekly")({ component: () => <Protected><WeeklyPage /></Protected> });

function WeeklyPage() {
  const q = useQuery({ queryKey: ["weekly"], queryFn: () => getWeeklyReview() });
  if (q.isLoading) return <PageSkeleton />;
  if (!q.data) {
    return (
      <ErrorBanner
        message={q.error?.message ?? "Could not load this week’s review."}
        onRetry={() => q.refetch()}
      />
    );
  }
  const n = q.data.narrative as {
    headline?: string;
    accuracy_note?: string;
    biggest_improvement?: string;
    biggest_weakness?: string;
    repeated_mistake?: string;
    next_week_priorities?: string[];
    coach_note?: string;
  };

  if (q.data.questions === 0) {
    return (
      <div>
        <PageHeader kicker="Weekly review" title="This week" lede="A honest snapshot, then a next action." />
        <EmptyState
          title="Nothing to review yet"
          lede="Do a few questions this week and the review will fill in — accuracy, improvement, and what to practise next."
          action={<PracticeCta />}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader kicker="Weekly review" title="This week" lede="A honest snapshot, then a next action." />
      <Card>
        <CardTitle className="text-2xl">{n.headline ?? "This week’s work"}</CardTitle>
        <p className="mt-3 text-fg-muted">{n.accuracy_note}</p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-xs text-fg-subtle">Questions</dt>
            <dd className="tabular-nums text-xl">{q.data.questions}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Accuracy</dt>
            <dd className="tabular-nums text-xl">{q.data.accuracy}%</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Time</dt>
            <dd className="tabular-nums text-xl">{q.data.minutes} min</dd>
          </div>
        </dl>
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Biggest improvement</CardTitle>
          <p className="mt-2 text-fg-muted">{n.biggest_improvement ?? "Keep going — more evidence needed."}</p>
        </Card>
        <Card>
          <CardTitle>Biggest weakness</CardTitle>
          <p className="mt-2 text-fg-muted">{n.biggest_weakness ?? "None flagged yet."}</p>
        </Card>
        <Card>
          <CardTitle>Repeated mistake</CardTitle>
          <p className="mt-2 text-fg-muted">{n.repeated_mistake ?? "No repeated slip yet."}</p>
        </Card>
        <Card>
          <CardTitle>Skills losing retention</CardTitle>
          <p className="mt-2 text-fg-muted">{q.data.slipping.join(", ") || "None flagged"}</p>
        </Card>
      </div>
      <Card className="mt-4">
        <CardTitle>Next week</CardTitle>
        <ul className="mt-2 list-disc pl-5 text-sm text-fg-muted">
          {(n.next_week_priorities ?? []).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        {n.coach_note ? <p className="mt-3 text-sm">{n.coach_note}</p> : null}
        <Button className="mt-4" asChild>
          <Link to="/plan">Open the plan</Link>
        </Button>
      </Card>
      <EstimateDisclaimer />
    </div>
  );
}