import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge, ProgressBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ErrorBanner, PageSkeleton, WatchVideo } from "@/components/ui/feedback";
import { getMarkedPaper } from "@/lib/server/papers";
import { parseJson } from "@/lib/utils";

export const Route = createFileRoute("/marker/$id")({
  component: () => (
    <Protected>
      <PaperReport />
    </Protected>
  ),
});

function PaperReport() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["paper", id], queryFn: () => getMarkedPaper({ data: { id } }) });

  if (q.isLoading) {
    return <PageSkeleton rows={4} />;
  }
  if (!q.data?.ok) {
    return (
      <ErrorBanner
        message={q.data && "error" in q.data ? q.data.error : q.error?.message}
        onRetry={() => q.refetch()}
      />
    );
  }

  const { paper, report, questions, marks } = q.data;
  const awarded = paper.total_awarded ?? report?.total_awarded ?? 0;
  const available = paper.total_available ?? report?.total_available ?? 0;
  const pct = available > 0 ? Math.round((awarded / available) * 100) : 0;

  return (
    <div>
      <Button variant="ghost" className="mb-2 -ml-2" asChild>
        <Link to="/marker">
          <ArrowLeft className="size-4" />
          All marked papers
        </Link>
      </Button>
      <PageHeader
        kicker="AI Paper Marker"
        title={paper.title}
        lede={`${paper.board !== "unspecified" ? paper.board + " · " : ""}Internal mark only — not an official exam-board result.`}
      />

      <Card>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Total</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <p className="font-display text-5xl tabular-nums tracking-tight">
            {awarded}
            <span className="text-2xl text-fg-muted">/{available}</span>
          </p>
          <div className="min-w-40 flex-1">
            <div className="mb-1 flex justify-between text-xs text-fg-subtle">
              <span>Raw mark</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
          </div>
        </div>
        {report?.overall_comment ? <p className="mt-4 text-sm leading-relaxed">{report.overall_comment}</p> : null}
        {report?.method_vs_accuracy ? (
          <p className="mt-2 text-sm text-fg-muted">{report.method_vs_accuracy}</p>
        ) : null}
        {report?.biggest_lost_marks?.length ? (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Biggest lost marks</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {report.biggest_lost_marks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <h2 className="mt-8 font-display text-2xl">Question by question</h2>
      <div className="mt-3 space-y-3">
        {(report?.questions ?? []).map((qMark) => {
          const row = questions.find((x) => x.ref === qMark.question_ref);
          const stored = marks.find((m) => m.question_id === row?.id);
          const points = qMark.points.length
            ? qMark.points
            : parseJson<typeof qMark.points>(stored?.points_json, []);
          const lost = qMark.max_marks - qMark.awarded;
          return (
            <Card key={qMark.question_ref} className={lost === 0 && !qMark.needs_review ? "pop-ok" : lost > 0 ? "shake-once" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Q{qMark.question_ref}</CardTitle>
                  <p className="mt-1 max-w-2xl text-sm text-fg-muted">{row?.prompt}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tabular-nums">
                    {qMark.awarded}/{qMark.max_marks}
                  </p>
                  {qMark.needs_review ? <Badge tone="warn">Needs review</Badge> : null}
                  {lost === 0 && !qMark.needs_review ? <Badge tone="ok">Full marks</Badge> : null}
                </div>
              </div>
              {qMark.student_answer_summary ? (
                <p className="mt-3 text-sm">
                  <span className="text-fg-subtle">You wrote: </span>
                  {qMark.student_answer_summary}
                </p>
              ) : null}
              <div className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Feedback</p>
                <p className="mt-1 text-fg-muted">{qMark.method_comment || qMark.examiner_note || "Check the mark points below against your working."}</p>
              </div>
              <ul className="mt-3 space-y-2">
                {points.map((pt, i) => (
                  <li
                    key={`${pt.code}-${i}`}
                    className="flex items-start gap-3 rounded-lg bg-bg px-3 py-2 text-sm"
                  >
                    <Badge tone={pt.awarded ? "ok" : pt.unsure ? "warn" : "danger"}>{pt.code}</Badge>
                    <span>
                      <span className="block">{pt.reason || (pt.awarded ? "Awarded" : "Not awarded")}</span>
                      {pt.evidence ? <span className="mt-0.5 block text-xs text-fg-subtle">{pt.evidence}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {qMark.mistakes.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {qMark.mistakes.map((m, i) => (
                    <p key={i} className="text-sm">
                      <Badge className="mr-2">{m.category}</Badge>
                      {m.how_to_avoid || m.why_wrong}
                    </p>
                  ))}
                </div>
              ) : null}
              {qMark.follow_through_applied ? (
                <p className="mt-2 text-xs text-ok">Follow-through applied — the same error was not penalised twice.</p>
              ) : null}
              {row?.skill_ids ? (
                <WatchVideo skillIds={parseJson<string[]>(row.skill_ids, [])} className="mt-2 -ml-3" />
              ) : null}
            </Card>
          );
        })}
      </div>

      {report?.warnings?.length ? (
        <p className="mt-4 text-sm text-warn">{report.warnings.join(" ")}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/marker">Mark another paper</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/mistakes">Review mistakes</Link>
        </Button>
      </div>
      <EstimateDisclaimer />
    </div>
  );
}
