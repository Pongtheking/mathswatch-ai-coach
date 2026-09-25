import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { ProgressBar } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, PracticeCta } from "@/components/ui/feedback";
import { listProgress } from "@/lib/server/fns";

export const Route = createFileRoute("/progress")({ component: () => <Protected><ProgressPage /></Protected> });

function ProgressPage() {
  const q = useQuery({ queryKey: ["progress"], queryFn: () => listProgress() });
  if (q.isLoading) return <PageSkeleton />;
  if (!q.data) {
    return (
      <ErrorBanner
        message={q.error?.message ?? "Could not load progress."}
        onRetry={() => q.refetch()}
      />
    );
  }
  const { byCat, overall, assessed, total } = q.data;

  return (
    <div>
      <PageHeader
        kicker="Progress"
        title="Mastery by skill"
        lede="Scores come from your attempts, recency, difficulty and mistakes — never from placeholder data."
      />
      <Card className="mb-4">
        <p className="text-sm text-fg-muted">Overall assessed mastery</p>
        <p className="font-display text-4xl tabular-nums">
          {overall === null ? "—" : `${Math.round(overall)}%`}
        </p>
        <p className="mt-1 text-sm text-fg-subtle">
          {assessed} of {total} skills have evidence
        </p>
      </Card>
      {assessed === 0 ? (
        <EmptyState
          title="No mastery evidence yet"
          lede="Curriculum skills are seeded. Your scores appear only after you attempt questions — nothing here is invented."
          action={<PracticeCta />}
        />
      ) : null}
      {Object.entries(byCat).map(([cat, skills]) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-3 font-display text-2xl">{cat}</h2>
          <Card className="p-0">
            <ul>
              {skills.map((s) => (
                <li key={s.id} className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{s.name}</p>
                    <p className="text-xs text-fg-subtle">{s.attempts} attempts</p>
                  </div>
                  <div className="w-28">
                    <ProgressBar value={s.score ?? 0} />
                  </div>
                  <span className="w-12 text-right text-sm tabular-nums text-fg-muted">
                    {s.score === null ? "—" : `${Math.round(s.score)}%`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      <EstimateDisclaimer />
    </div>
  );
}
