import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/layout/app-shell";

export function Protected({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <div className="w-64 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-bg-subtle" />
          <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
          <p className="text-sm text-fg-muted">Loading your session…</p>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <AppShell>{children}</AppShell>;
}
