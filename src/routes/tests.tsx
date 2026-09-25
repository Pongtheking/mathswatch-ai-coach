import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, ScanSearch } from "lucide-react";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorBanner, PageSkeleton, WorkingOverlay } from "@/components/ui/feedback";
import { listTests, startTest } from "@/lib/server/fns";

export const Route = createFileRoute("/tests")({ component: () => <Protected><TestsPage /></Protected> });

function TestsPage() {
  const nav = useNavigate();
  const list = useQuery({ queryKey: ["tests"], queryFn: () => listTests() });
  const start = useMutation({
    mutationFn: startTest,
    onSuccess: (res) => {
      if (!res.ok) return;
      void nav({ to: "/exam/$id", params: { id: res.testId } });
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Tests"
        title="Diagnostics, papers, and marking"
        lede="Sit a diagnostic, run an exam simulator, or upload a completed paper with its mark scheme for AI marking."
      />

      <Card className="mb-6 border-accent/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">AI Paper Marker</p>
            <CardTitle className="mt-1">Mark a completed paper</CardTitle>
            <CardHint>
              Upload the paper you sat and the official mark scheme. Marks follow M1 / A1 / B1, follow-through, and alternatives — not a guessed answer key.
            </CardHint>
          </div>
          <Button size="lg" className="min-h-12 w-full rounded-full sm:w-auto" asChild>
            <Link to="/marker">
              <ScanSearch className="size-4" />
              Open marker
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Card>

      {start.isPending ? (
        <WorkingOverlay title="Building the paper…" lede="Choosing questions across the curriculum." />
      ) : null}
      {start.isError ? (
        <ErrorBanner className="mb-4" message={start.error.message} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Quick diagnostic</CardTitle>
          <CardHint>10 questions across the curriculum.</CardHint>
          <Button className="mt-4" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "quick" } })}>
            {start.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Start
          </Button>
        </Card>
        <Card>
          <CardTitle>Topic diagnostic</CardTitle>
          <CardHint>20 questions in algebra — the usual Grade 9 bottleneck.</CardHint>
          <Button className="mt-4" variant="outline" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "topic", skillId: "alg.solving-quadratic" } })}>
            Algebra 20
          </Button>
        </Card>
        <Card>
          <CardTitle>Full diagnostic</CardTitle>
          <CardHint>32 mixed questions. Untimed, for a map of strengths.</CardHint>
          <Button className="mt-4" variant="outline" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "full" } })}>
            Start
          </Button>
        </Card>
        <Card>
          <CardTitle>Grade 9 diagnostic</CardTitle>
          <CardHint>Higher-tier questions only.</CardHint>
          <Button className="mt-4" variant="outline" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "grade9" } })}>
            Start
          </Button>
        </Card>
      </div>

      <h2 className="mt-8 font-display text-2xl">Exam simulator</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Non-calculator</CardTitle>
          <CardHint>20 questions · 45 minutes. Flag, review, then mark.</CardHint>
          <Button className="mt-4" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "exam", calculator: "non-calculator", timed: true } })}>
            Start paper
          </Button>
        </Card>
        <Card>
          <CardTitle>Calculator</CardTitle>
          <CardHint>20 questions · 45 minutes.</CardHint>
          <Button className="mt-4" variant="outline" disabled={start.isPending} onClick={() => start.mutate({ data: { kind: "exam", calculator: "calculator", timed: true } })}>
            Start paper
          </Button>
        </Card>
      </div>

      {list.isLoading ? (
        <div className="mt-6">
          <PageSkeleton rows={1} />
        </div>
      ) : list.data && list.data.length > 0 ? (
        <Card className="mt-6">
          <CardTitle>History</CardTitle>
          <ul className="mt-3 space-y-2">
            {list.data.map((t) => (
              <li key={t.id}>
                <Link to="/exam/$id" params={{ id: t.id }} className="flex min-h-12 items-center justify-between rounded-lg px-2 py-2 hover:bg-bg-subtle">
                  <span>
                    {t.title} <Badge className="ml-2">{t.status}</Badge>
                  </span>
                  <span className="tabular-nums text-sm text-fg-muted">
                    {t.score !== null ? `${t.score}/${t.max_score}` : "in progress"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No tests sat yet"
            lede="Start a quick diagnostic to map strengths, or mark a completed paper instead."
          />
        </div>
      )}
      <EstimateDisclaimer />
    </div>
  );
}