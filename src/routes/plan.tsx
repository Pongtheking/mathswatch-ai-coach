import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, PracticeCta } from "@/components/ui/feedback";
import { getPlans } from "@/lib/server/fns";

export const Route = createFileRoute("/plan")({ component: () => <Protected><PlanPage /></Protected> });

function PlanPage() {
  const q = useQuery({ queryKey: ["plans"], queryFn: () => getPlans() });
  if (q.isLoading) return <PageSkeleton rows={3} />;
  if (!q.data) {
    return (
      <ErrorBanner
        message={q.error?.message ?? "Could not build a plan."}
        onRetry={() => q.refetch()}
      />
    );
  }
  const { today, week, next } = q.data;
  const empty = today.items.length === 0;

  return (
    <div>
      <PageHeader
        kicker="Plan"
        title="Personal revision"
        lede="Today, this week and next week — rebuilt from your latest evidence."
      />
      {empty ? (
        <EmptyState
          title="No plan yet"
          lede="Capture a question or sit a short diagnostic so the coach has something to schedule."
          action={<PracticeCta />}
        />
      ) : (
        <Card className="mb-4">
          <p className="text-xs uppercase tracking-wider text-fg-subtle">Today · {today.minutes} minutes</p>
          <CardTitle className="mt-1">Today</CardTitle>
          <p className="mt-2 text-sm text-fg-muted">{today.rationale}</p>
          <ol className="mt-4 space-y-3">
            {today.items.map((item) => (
              <li key={item.id} className="flex gap-4 rounded-lg bg-bg-subtle p-3">
                <span className="w-14 shrink-0 text-sm tabular-nums text-fg-subtle">{item.minutes} min</span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-fg-muted">{item.detail}</p>
                  <Badge className="mt-1">{item.kind}</Badge>
                </div>
              </li>
            ))}
          </ol>
          <Button className="mt-4" asChild>
            <Link to="/practice">Start today’s session</Link>
          </Button>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>This week</CardTitle>
          <CardHint>{week.rationale}</CardHint>
          {week.items.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">Week plan fills in after a few attempts.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {week.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 text-sm">
                  <span>{i.title}</span>
                  <span className="tabular-nums text-fg-subtle">{i.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Next week</CardTitle>
          <CardHint>{next.rationale}</CardHint>
          {next.items.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">Nothing queued yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {next.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 text-sm">
                  <span>{i.title}</span>
                  <span className="tabular-nums text-fg-subtle">{i.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}