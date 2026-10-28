import { useAuthStore } from "@/stores/auth-store";
import { getApiUrl } from "@/lib/api/client";

const API_URL = getApiUrl();

export type CapturePhotoResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unsupported" | "upload-failed" };

// Disclosed webcam capture, required at every clock-in AND clock-out (see
// work-session-toggle.tsx) -- the browser's own camera-permission prompt is
// the disclosure mechanism, and there is no way to make this covert, by
// design. Unlike an earlier best-effort version of this, denial/no-camera
// is now a hard gate the caller must block on -- only "denied"/"unsupported"
// block clocking in/out, though: a photo that was captured fine but failed
// to *upload* (network hiccup, server error) doesn't punish the employee
// for something outside their control, so callers should still allow the
// action through for that one.
export async function captureClockPhoto(
  type: "CLOCK_IN" | "CLOCK_OUT" | "LOGIN" | "LOGOUT" = "CLOCK_IN",
): Promise<CapturePhotoResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch {
    return { ok: false, reason: "denied" };
  }

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Give the first real frame a moment to decode.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
    );
    if (!blob) return { ok: false, reason: "upload-failed" };

    // Deliberately not using apiFetch -- multipart bodies must NOT have a
    // manual Content-Type (the browser sets the boundary), and apiFetch's
    // refresh-retry plumbing isn't worth the extra complexity here.
    const token = useAuthStore.getState().accessToken;
    const form = new FormData();
    form.append("file", blob, "clock.jpg");
    form.append("type", type);
    const res = await fetch(`${API_URL}/login-photos`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok) return { ok: false, reason: "upload-failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "upload-failed" };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
