import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Camera,
  ClipboardList,
  Flag,
  Home,
  MoreHorizontal,
  ScanSearch,
  Settings,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/practice", label: "Practice", icon: BookOpen },
  { to: "/capture", label: "Capture", icon: Camera },
  { to: "/marker", label: "Marker", icon: ScanSearch },
  { to: "/tests", label: "Tests", icon: Flag },
  { to: "/plan", label: "Plan", icon: ClipboardList },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/grade-9", label: "Grade 9", icon: Target },
  { to: "/mistakes", label: "Mistakes", icon: TriangleAlert },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) =>
    ["/", "/practice", "/capture", "/marker", "/tests"].includes(n.to),
  );
  const extra = NAV.filter((n) => !primary.includes(n));

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-accent text-accent-fg font-display text-sm">
              M
            </span>
            <span className="max-w-[11.5rem] truncate font-display text-lg tracking-tight sm:max-w-none">
              MathsWatch AI Coach
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isPending ? (
              <div className="size-8 animate-pulse rounded-full bg-bg-subtle" />
            ) : user ? (
              <UserButton />
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <nav
          aria-label="Main"
          className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-3 md:flex"
        >
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors",
                  active ? "bg-bg-subtle text-fg" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main
          id="main"
          key={pathname}
          className="page-enter min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-6 gap-0 px-1 py-1">
          {primary.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            const featured = item.to === "/marker";
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium",
                  featured
                    ? "text-accent"
                    : active
                      ? "text-fg"
                      : "text-fg-subtle",
                )}
              >
                <Icon className={cn("size-5", featured && "size-6")} strokeWidth={featured ? 2 : 1.75} />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-fg-subtle"
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>

      {more ? (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-bg/60" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-xl border border-border bg-bg-elevated p-4 pb-24"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 font-display text-lg">More</p>
            <div className="grid grid-cols-2 gap-2">
              {extra.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMore(false)}
                    className="flex min-h-14 items-center gap-3 rounded-lg border border-border px-3"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="mb-6">
      {kicker ? (
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">{kicker}</p>
      ) : null}
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
      {lede ? <p className="mt-2 max-w-2xl text-fg-muted">{lede}</p> : null}
    </header>
  );
}

export function EstimateDisclaimer() {
  return (
    <p className="mt-6 text-xs text-fg-subtle">
      Learning estimates are internal. They are not official GCSE grade predictions.
    </p>
  );
}
