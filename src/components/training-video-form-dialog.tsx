import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTrainingVideo,
  useTrainingVideos,
  useUpdateTrainingVideo,
} from "@/hooks/use-training-videos";
import { toEmbedUrl, videoSourceLabel } from "@/lib/video-embed";
import type { TrainingVideo } from "@/lib/api/training-videos";

interface TrainingVideoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Present = editing that entry; absent = adding a new one.
  video?: TrainingVideo;
}

export function TrainingVideoFormDialog({
  open,
  onOpenChange,
  video,
}: TrainingVideoFormDialogProps) {
  const isEdit = !!video;
  const create = useCreateTrainingVideo();
  const update = useUpdateTrainingVideo();
  // Served from the list query's cache -- only used to suggest sections that
  // already exist, so re-typing "Getting Started" by hand doesn't create a
  // near-duplicate group.
  const { data: allVideos } = useTrainingVideos(open);
  const existingCategories = Array.from(
    new Set((allVideos ?? []).map((v) => v.category).filter((c): c is string => !!c)),
  );

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(video?.title ?? "");
    setUrl(video?.url ?? "");
    setDescription(video?.description ?? "");
    setCategory(video?.category ?? "");
    setPosition(video ? String(video.position) : "");
    setError(null);
  }, [open, video]);

  const busy = create.isPending || update.isPending;
  const trimmedUrl = url.trim();
  const playsInline = !!trimmedUrl && !!toEmbedUrl(trimmedUrl);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      title,
      url: trimmedUrl,
      description: description.trim(),
      category: category.trim(),
      position: position ? Number(position) : 0,
    };
    try {
      if (isEdit && video) {
        await update.mutateAsync({ id: video.id, input });
      } else {
        await create.mutateAsync(input);
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : isEdit
            ? "Could not save changes"
            : "Could not add this video",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit video" : "Add a walkthrough"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="video-url">Video link</Label>
            <Input
              id="video-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/…/view"
              required
              autoFocus={!isEdit}
            />
            <p className="text-[10px] text-text-dim">
              {trimmedUrl && playsInline ? (
                <span className="text-success">
                  {videoSourceLabel(trimmedUrl)} link — this will play inside the panel.
                </span>
              ) : trimmedUrl ? (
                <span>
                  {videoSourceLabel(trimmedUrl)} link — it will open in a new tab rather than
                  playing inline.
                </span>
              ) : (
                "Paste a Google Drive, YouTube, Loom, or Vimeo link. Drive and the rest play inline; anything else opens in a new tab."
              )}
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-canvas/30 px-3 py-2">
            <p className="text-[10px] text-text-dim">
              <span className="text-foreground font-medium">Sharing matters:</span> in Drive, set
              the file to <span className="text-foreground">“Anyone with the link”</span> before
              pasting it. Managers viewing this page aren’t signed into your Drive, so a restricted
              file shows them a permission wall instead of the video.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Adding a deal and moving it through the pipeline"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="video-description">Description</Label>
            <Textarea
              id="video-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this walkthrough covers"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="video-category">Section</Label>
              <Input
                id="video-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Getting Started"
                list="training-video-categories"
              />
              <datalist id="training-video-categories">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-position">Order</Label>
              <Input
                id="video-position"
                type="number"
                min={0}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-xs text-text-dim">
            Videos are grouped by section and listed lowest order first. Leave the section blank to
            file it under “General”.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
