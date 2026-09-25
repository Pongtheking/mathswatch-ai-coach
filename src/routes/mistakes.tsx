import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CaptureCta, EmptyState, ErrorBanner, PageSkeleton, WatchVideo } from "@/components/ui/feedback";
import { listMistakes, startPractice } from "@/lib/server/fns";

export const Route = createFileRoute("/mistakes")({ component: () => <Protected><MistakesPage /></Protected> });

function MistakesPage() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["mistakes"], queryFn: () => listMistakes() });
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
        message={q.error?.message ?? "Could not load mistakes."}
        onRetry={() => q.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Mistakes"
        title="The error pattern, not just the topic"
        lede="Sign errors, method choice, misreads — the coach tracks the type of slip so practice can target it."
      />
      {q.data.rows.length === 0 ? (
        <EmptyState
          title="No mistakes stored yet"
          lede="Capture a question, write your working, and check it. Patterns appear once the coach has seen a few slips."
          action={<CaptureCta />}
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardTitle className="text-lg">Pattern</CardTitle>
            <p className="mt-2 text-fg-muted">{q.data.pattern}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.data.grouped.map((g) => (
                <Badge key={g.category}>
                  {g.category} · {g.n}
                </Badge>
              ))}
            </div>
            <Button className="mt-4" disabled={go.isPending} onClick={() => go.mutate({ data: { mode: "mistakes" } })}>
              {go.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Practise the pattern
            </Button>
          </Card>
          <ul className="space-y-3">
            {q.data.rows.map((m) => (
              <Card key={m.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.corrected ? "ok" : "danger"}>{m.category}</Badge>
                  <span className="text-xs text-fg-subtle">{m.skillName}</span>
                </div>
                <p className="mt-3 text-sm">
                  <strong>You did:</strong> {m.what_student_did}
                </p>
                <p className="mt-1 text-sm">
                  <strong>Should have:</strong> {m.what_should}
                </p>
                <p className="mt-1 text-sm text-fg-muted">{m.how_to_avoid}</p>
                <WatchVideo skillId={m.skill_id} className="mt-2 -ml-3" />
              </Card>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}