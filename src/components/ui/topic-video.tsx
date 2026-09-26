import { Play, Youtube } from "lucide-react";
import { useState } from "react";
import {
  embedUrl,
  firstVideoForSkills,
  thumbnailUrl,
  videoForSkill,
  videoForSkillName,
  type SkillVideo,
} from "@/lib/curriculum/videos";
import { cn } from "@/lib/utils";

export function TopicVideo({
  skillId,
  skillIds,
  skillName,
  collapsed = false,
  className,
}: {
  skillId?: string | null;
  skillIds?: Array<string | undefined | null>;
  skillName?: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  const video = skillId
    ? videoForSkill(skillId)
    : skillName
      ? videoForSkillName(skillName)
      : firstVideoForSkills(skillIds ?? []);
  if (!video) return null;
  return <TopicVideoCard video={video} collapsed={collapsed} className={className} />;
}

export function TopicVideoCard({
  video,
  collapsed = false,
  className,
}: {
  video: SkillVideo;
  collapsed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const thumb = thumbnailUrl(video);
  const embed = embedUrl(video);

  const player = (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="relative aspect-video w-full bg-black">
        {playing && embed ? (
          <iframe
            title={`${video.title} — ${video.channel}`}
            src={`${embed}&autoplay=1`}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (embed) setPlaying(true);
              else window.open(video.href, "_blank", "noopener,noreferrer");
            }}
            className="group absolute inset-0 flex items-center justify-center"
            aria-label={embed ? `Play ${video.title}` : `Open ${video.title} on YouTube`}
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-90 transition group-hover:opacity-100"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]" />
            )}
            <span className="relative flex size-16 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition group-hover:scale-105">
              <Play className="ml-0.5 size-7 fill-current" />
            </span>
          </button>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{video.title}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {video.youtubeId ? `${video.channel} · topic walkthrough, not this question’s answer` : "YouTube · GCSE topic video results"}
          </p>
        </div>
        <a
          href={video.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-2 text-sm text-accent hover:bg-accent/10"
        >
          <Youtube className="size-4" />
          YouTube
        </a>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div className={cn("mt-4", className)}>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Youtube className="size-4 shrink-0 text-accent" />
            <span className="truncate">
              Watch a video on {video.title}
            </span>
          </span>
          <span className="text-xs text-fg-subtle">{open ? "Hide" : "Show"}</span>
        </button>
        {open ? <div className="mt-2">{player}</div> : null}
      </div>
    );
  }

  return <div className={cn("mt-4", className)}>{player}</div>;
}
