import { useRef, useState } from "react";
import {
  Download,
  FastForward,
  ImageOff,
  Loader2,
  Rewind,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useScreenRecordingVideo } from "@/hooks/use-screen-recordings";
import {
  downloadScreenRecording,
  recordingFilename,
  type ScreenRecording,
} from "@/lib/api/screen-recordings";

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4];
const SKIP_SECONDS = 10;

// Extracted from screen-monitoring.tsx so the employee-daily-log page can
// reuse the same recording playback and download UI.
export function RecordingViewerDialog({
  recording,
  onOpenChange,
}: {
  recording: ScreenRecording | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const videoUrl = useScreenRecordingVideo(recording?.id);
  const [isDownloading, setIsDownloading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);

  const skip = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const end = Number.isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.min(Math.max(0, v.currentTime + seconds), end);
  };
  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const handleDownload = async () => {
    if (!recording) return;
    setIsDownloading(true);
    try {
      await downloadScreenRecording(recording.id, recordingFilename(recording));
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download recording");
      console.error("Download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={!!recording} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          skip(e.key === "ArrowLeft" ? -SKIP_SECONDS : SKIP_SECONDS);
        }}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pr-6">
          <DialogTitle className="truncate">
            {recording
              ? `${recording.user.firstName} ${recording.user.lastName} · ${new Date(recording.startedAt).toLocaleString()}`
              : ""}
          </DialogTitle>
          {recording && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download
            </Button>
          )}
        </DialogHeader>
        {videoUrl ? (
          <>
            <video
              key={videoUrl}
              ref={videoRef}
              src={videoUrl}
              controls
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = speed;
              }}
              controlsList="nodownload"
              className="aspect-video w-full rounded-lg border border-border-subtle bg-black"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => skip(-30)}>
                <Rewind className="size-4" /> 30s
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => skip(-10)}>
                <SkipBack className="size-4" /> 10s
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => skip(10)}>
                10s <SkipForward className="size-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => skip(30)}>
                30s <FastForward className="size-4" />
              </Button>
              <div className="ml-2 flex items-center gap-1">
                {PLAYBACK_SPEEDS.map((s) => (
                  <Button
                    key={s}
                    variant={speed === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeSpeed(s)}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex aspect-video items-center justify-center gap-2 text-text-dim">
            <ImageOff className="size-4" />
            Loading recording…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
