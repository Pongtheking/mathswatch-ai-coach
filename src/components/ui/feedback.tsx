import { Link } from "@tanstack/react-router";
import { Camera, CircleAlert, Loader2, Play, RefreshCw, Youtube } from "lucide-react";
import type { ReactNode } from "react";
import { firstVideoForSkills, videoForSkill, videoForSkillName } from "@/lib/curriculum/videos";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function friendlyAiError(raw: string | undefined | null): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "Something went wrong. Please retry.";
  if (/add your gemini api key|before marking|before using ai/i.test(msg)) {
    return "Add your Gemini API key before marking. Open Settings, paste a real key from Google AI Studio, and save.";
  }
  if (/fake, revoked|401|403|invalid authentication/i.test(msg)) {
    return "That API key is not real (or was revoked). Create a new one in Google AI Studio and paste the whole key.";
  }
  if (/429|quota/i.test(msg)) {
    return "Google's free Gemini quota is currently exhausted for this key. Waiting a minute only helps with a short rate limit; if it happens again, wait for Google's quota reset before trying another mark.";
  }
  if (/not available/i.test(msg)) {
    return "Add your Gemini API key in Settings before using AI marking.";
  }
  if (/validat/i.test(msg)) return "The AI response could not be read cleanly. Retry with a clearer photo or PDF.";
  if (/network|failed to fetch|timeout/i.test(msg)) return "Network hiccup talking to the coach. Check your connection and retry.";
  return msg;
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="page-enter space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-6 w-40 animate-pulse rounded bg-bg-subtle" />
      <div className="h-10 w-72 max-w-full animate-pulse rounded bg-bg-subtle" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-bg-subtle" />
      ))}
      <p className="text-sm text-fg-muted">Loading…</p>
    </div>
  );
}

export function EmptyState({
  title,
  lede,
  action,
}: {
  title: string;
  lede: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-enter rounded-xl border border-dashed border-border bg-bg-elevated px-5 py-8 text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{lede}</p>
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "shake-once rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{friendlyAiError(message)}</span>
      </p>
      {onRetry ? (
        <Button className="mt-3" size="sm" variant="outline" type="button" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function NeedKeyBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm", className)}
    >
      <p className="font-medium">Add a Gemini API key before marking.</p>
      <p className="mt-1 text-fg-muted">
        Each account has its own key. The app checks with Google that it is real, then uses it only for you.
      </p>
      <Button asChild className="mt-3" size="sm">
        <Link to="/settings">Open Settings</Link>
      </Button>
    </div>
  );
}

export function WorkingOverlay({
  title,
  lede,
}: {
  title: string;
  lede?: string;
}) {
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-accent" />
      <div>
        <p className="font-medium">{title}</p>
        {lede ? <p className="mt-1 text-sm text-fg-muted">{lede}</p> : null}
      </div>
    </div>
  );
}

export function WatchVideo({
  skillId,
  skillIds,
  skillName,
  className,
}: {
  skillId?: string | null;
  skillIds?: Array<string | undefined | null>;
  skillName?: string | null;
  className?: string;
}) {
  const video = skillId
    ? videoForSkill(skillId)
    : skillName
      ? videoForSkillName(skillName)
      : firstVideoForSkills(skillIds ?? []);
  if (!video) return null;
  return (
    <a
      href={video.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-accent hover:bg-accent/10",
        className,
      )}
    >
      <Youtube className="size-4 shrink-0" />
      Watch {video.title}
    </a>
  );
}

export function CaptureCta() {
  return (
    <Button asChild>
      <Link to="/capture">
        <Camera className="size-4" />
        Capture a question
      </Link>
    </Button>
  );
}

export function PracticeCta() {
  return (
    <Button asChild>
      <Link to="/practice">
        <Play className="size-4" />
        Start practice
      </Link>
    </Button>
  );
}
