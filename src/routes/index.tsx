import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Camera, Play, ScanSearch } from "lucide-react";
import { EstimateDisclaimer, PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Badge, ProgressBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { WatchVideo } from "@/components/ui/feedback";
import { getBootstrap } from "@/lib/server/fns";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <Protected>
      <Dashboard />
    </Protected>
  );
}

function Dashboard() {
  const q = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  if (q.isLoading) return <DashSkeleton />;
  if (q.error) {
    return (
      <Card>
        <CardTitle>Could not load your dashboard</CardTitle>
        <CardHint>{q.error.message}</CardHint>
        <Button className="mt-4" onClick={() => q.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }
  const d = q.data!;
  const priority = d.ranked[0];
  const estimate = d.gradeEstimate;
  const progress = d.pathToNine ?? (estimate ? Math.min(100, (estimate / 9) * 100) : 0);

  return (
    <div>
      <PageHeader
        kicker="Grade 9 mission"
        title={`Hello${d.profile.display_name ? `, ${d.profile.display_name.split(" ")[0]}` : ""}`}
        lede="What you should do right now, based on actual attempts — not guesses."
      />

      {d.missedToday ? (
        <Card className="mb-4 border-warn/30">
          <CardTitle className="text-lg">You missed today’s session.</CardTitle>
          <p className="mt-2 text-sm text-fg-muted">
            No problem — but we still need to move forward. Fifteen minutes is enough to keep the loop going.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/practice">Do 15 minutes now</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/plan">Complete full session</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/plan">Reschedule</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Internal learning estimate</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-5xl tabular-nums tracking-tight">
              {estimate === null ? "—" : estimate.toFixed(1)}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              Target 9 · {d.assessedSkills} skills assessed
              {d.gradeConfidence ? ` · ${d.gradeConfidence === "too-early" ? "too early" : d.gradeConfidence + " confidence"}` : ""}
            </p>
          </div>
          <div className="min-w-48 flex-1">
            <div className="mb-1 flex justify-between text-xs text-fg-subtle">
              <span>Progress toward 9</span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <ProgressBar value={progress} />
            <p className="mt-2 text-xs text-fg-subtle">Not an official GCSE prediction. Unseen higher-tier skills pull this down on purpose.</p>
            {d.whyNotNine?.[0] ? (
              <p className="mt-2 text-sm text-fg-muted">{d.whyNotNine[0]}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-bg-subtle p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Today’s priority</p>
          <p className="mt-1 font-display text-2xl">{priority?.name ?? "Take a diagnostic"}</p>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            {priority?.whyItMatters ??
              "We do not invent a level. Capture a MathsWatch question or sit a 10-question diagnostic so the coach has evidence."}
          </p>
          <WatchVideo skillId={priority?.skillId} className="mt-2 -ml-3" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link to="/practice">
                <Play className="size-4" />
                Start today’s session
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/capture">
                <Camera className="size-4" />
                Capture question
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/marker">
                <ScanSearch className="size-4" />
                Mark a paper
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Top weaknesses</CardTitle>
          <CardHint>From recorded attempts, weighted by GCSE importance.</CardHint>
          <ul className="mt-4 space-y-3">
            {d.weak.length === 0 ? (
              <li className="text-sm text-fg-muted">No assessed weaknesses yet — capture a question or sit a diagnostic.</li>
            ) : (
              d.weak.map((w, i) => (
                <li key={w.skillId} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    <span className="mr-2 tabular-nums text-fg-subtle">{i + 1}.</span>
                    {w.name}
                  </span>
                  <span className="tabular-nums text-sm text-fg-muted">{Math.round(w.mastery ?? 0)}%</span>
                </li>
              ))
            )}
          </ul>
        </Card>
        <Card>
          <CardTitle>Recent improvement</CardTitle>
          <CardHint>Recent accuracy running ahead of stored mastery.</CardHint>
          <ul className="mt-4 space-y-3">
            {d.improved.length === 0 ? (
              <li className="text-sm text-fg-muted">Improvements appear after repeated practice.</li>
            ) : (
              d.improved.map((w) => (
                <li key={w.skillId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{w.name}</span>
                  <Badge tone="ok">+{w.delta.toFixed(0)}%</Badge>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-fg-subtle">This week</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{d.week.questions}</p>
          <p className="text-sm text-fg-muted">questions · {d.week.correct} correct</p>
        </Card>
        <Card>
          <p className="text-xs text-fg-subtle">Streak</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{d.profile.current_streak}</p>
          <p className="text-sm text-fg-muted">days · best {d.profile.longest_streak}</p>
        </Card>
        <Card>
          <p className="text-xs text-fg-subtle">Curriculum</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{d.skillsCount}</p>
          <p className="text-sm text-fg-muted">GCSE skills mapped</p>
        </Card>
      </div>

      {d.recentMistakes.length > 0 ? (
        <Card className="mt-4">
          <div className="flex items-center justify-between">
            <CardTitle>Recent mistakes</CardTitle>
            <Link to="/mistakes" className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
              All <ArrowRight className="size-4" />
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {d.recentMistakes.map((m) => (
              <li key={m.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <Badge>{m.category}</Badge>
                  <span className="text-xs text-fg-subtle">{m.skillName}</span>
                </div>
                <p className="mt-1 text-sm">{m.what_student_did}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link to="/tests">Quick diagnostic</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/grade-9">Grade 9 gap</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/weekly">Weekly review</Link>
        </Button>
      </div>
      <EstimateDisclaimer />
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded bg-bg-subtle" />
      <div className="h-56 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </div>
  );
}
