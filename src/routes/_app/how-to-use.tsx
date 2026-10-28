import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type MouseEvent } from "react";
import {
  ExternalLink,
  GraduationCap,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrainingVideoFormDialog } from "@/components/training-video-form-dialog";
import { useDeleteTrainingVideo, useTrainingVideos } from "@/hooks/use-training-videos";
import { toEmbedUrl, videoSourceLabel } from "@/lib/video-embed";
import { useAuthStore } from "@/stores/auth-store";
import type { TrainingVideo } from "@/lib/api/training-videos";

export const Route = createFileRoute("/_app/how-to-use")({
  component: HowToUsePage,
});

const UNCATEGORIZED = "General";

function HowToUsePage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role.name === "ADMIN";
  const isManager = currentUser?.role.name === "MANAGER";
  // Admins and Managers can add videos; all employees can watch
  const canAdd = isAdmin || isManager;
  // Editing/deleting is narrower: your own entries, or anything if Admin.
  const canManage = (video: TrainingVideo) => isAdmin || video.uploader.id === currentUser?.id;

  const { data: videos, isLoading } = useTrainingVideos(true);
  const deleteVideo = useDeleteTrainingVideo();

  const [watching, setWatching] = useState<TrainingVideo | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingVideo | undefined>(undefined);

  // Preserves the server's ordering (section, then position, then oldest
  // first) while splitting it into the sections the page renders.
  const sections = useMemo(() => {
    const grouped = new Map<string, TrainingVideo[]>();
    for (const video of videos ?? []) {
      const key = video.category ?? UNCATEGORIZED;
      const existing = grouped.get(key);
      if (existing) existing.push(video);
      else grouped.set(key, [video]);
    }
    return Array.from(grouped.entries());
  }, [videos]);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(e: MouseEvent, video: TrainingVideo) {
    e.stopPropagation();
    setEditing(video);
    setFormOpen(true);
  }

  function handleDelete(e: MouseEvent, video: TrainingVideo) {
    e.stopPropagation();
    if (!confirm(`Remove “${video.title}” from this page? The video itself isn't touched.`)) return;
    deleteVideo.mutate(video.id);
  }

  // Links we can embed open in the panel; anything else goes to a new tab,
  // since we can't play it inline anyway.
  function openVideo(video: TrainingVideo) {
    if (toEmbedUrl(video.url)) {
      setWatching(video);
    } else {
      window.open(video.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <GraduationCap className="size-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">How to Use CRM</h1>
          <p className="text-sm text-text-dim mt-1">
            Recorded walkthroughs of the CRM, for admins and managers. New links appear here as soon
            as they're added.
          </p>
        </div>
        {canAdd && (
          <Button onClick={openAdd} className="gap-1.5 shrink-0">
            <Plus className="size-4" />
            Add video
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-20 text-text-dim">
          <Loader2 className="size-4 animate-spin" />
          Loading walkthroughs…
        </div>
      )}

      {!isLoading && sections.length === 0 && (
        <div className="bg-panel border border-border-subtle rounded-xl py-20 px-6 text-center">
          <VideoOff className="size-6 mx-auto text-text-dim" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium">No walkthroughs yet</p>
          <p className="mt-1 text-sm text-text-dim">
            {canAdd
              ? "Paste a Drive or YouTube link and it'll show up here for every admin and manager."
              : "Nobody has added any training videos yet — check back soon."}
          </p>
          {canAdd && (
            <Button onClick={openAdd} variant="outline" className="mt-4 gap-1.5">
              <Plus className="size-4" />
              Add the first one
            </Button>
          )}
        </div>
      )}

      {sections.map(([section, sectionVideos]) => (
        <div key={section} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium tracking-tight">{section}</h2>
            <span className="text-xs text-text-dim font-mono">{sectionVideos.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectionVideos.map((video) => {
              const inline = !!toEmbedUrl(video.url);
              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => openVideo(video)}
                  className="group text-left bg-panel border border-border-subtle rounded-xl p-4 hover:border-primary/40 hover:bg-panel-elevated/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                      {inline ? (
                        <PlayCircle className="size-5" strokeWidth={1.75} />
                      ) : (
                        <ExternalLink className="size-4" strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{video.title}</p>
                      {video.description && (
                        <p className="text-xs text-text-dim mt-1 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                      <p className="text-[11px] text-text-dim mt-2">
                        {videoSourceLabel(video.url)}
                        {!inline && " · opens in a new tab"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border-subtle">
                    <span className="text-[11px] text-text-dim flex-1 truncate">
                      Added by {video.uploader.firstName} {video.uploader.lastName}
                    </span>
                    {canManage(video) && (
                      <>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => openEdit(e, video)}
                          onKeyDown={(e) => e.key === "Enter" && openEdit(e as never, video)}
                          className="size-7 grid place-items-center rounded-md text-text-dim hover:text-foreground hover:bg-accent transition-colors"
                          title="Edit details"
                        >
                          <Pencil className="size-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDelete(e, video)}
                          onKeyDown={(e) => e.key === "Enter" && handleDelete(e as never, video)}
                          className="size-7 grid place-items-center rounded-md text-text-dim hover:text-destructive hover:bg-accent transition-colors"
                          title="Remove from this page"
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <VideoPlayerDialog
        video={watching}
        onOpenChange={(open) => !open && setWatching(undefined)}
      />
      <TrainingVideoFormDialog open={formOpen} onOpenChange={setFormOpen} video={editing} />
    </div>
  );
}

function VideoPlayerDialog({
  video,
  onOpenChange,
}: {
  video: TrainingVideo | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const embedUrl = video ? toEmbedUrl(video.url) : null;

  return (
    <Dialog open={!!video} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{video?.title ?? ""}</DialogTitle>
        </DialogHeader>
        {embedUrl && (
          <iframe
            // Remount on url change so switching videos never leaves the
            // previous one playing in the same frame.
            key={embedUrl}
            src={embedUrl}
            title={video?.title ?? "Training video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video rounded-lg border border-border-subtle bg-black"
          />
        )}
        {video?.description && <p className="text-sm text-text-dim">{video.description}</p>}
        {video && (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 self-start"
          >
            <ExternalLink className="size-3" />
            Open in {videoSourceLabel(video.url)}
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
