// Turns a share link into something an <iframe> can play inline, so a
// walkthrough opens inside the panel instead of bouncing the viewer out to
// another tab. Returns null for anything we don't recognize -- the page falls
// back to a plain "open in a new tab" link in that case, which always works.
//
// Note the host allow-list is deliberate: an arbitrary URL is never dropped
// into an iframe, only URLs on providers we recognize.
export function toEmbedUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  // Google Drive: .../file/d/FILE_ID/view?usp=sharing  →  .../file/d/FILE_ID/preview
  // Also handles the older /open?id=FILE_ID form.
  if (host === "drive.google.com") {
    const pathMatch = /\/file\/d\/([^/]+)/.exec(url.pathname);
    const fileId = pathMatch?.[1] ?? url.searchParams.get("id");
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      url.searchParams.get("v") ?? /\/(?:embed|shorts)\/([^/?]+)/.exec(url.pathname)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (host === "youtu.be") {
    const videoId = url.pathname.slice(1);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }

  if (host === "loom.com") {
    const shareId = /\/(?:share|embed)\/([^/?]+)/.exec(url.pathname)?.[1];
    return shareId ? `https://www.loom.com/embed/${shareId}` : null;
  }

  if (host === "vimeo.com") {
    const videoId = /^\/(\d+)/.exec(url.pathname)?.[1];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  }

  return null;
}

// Short provider label for the card, e.g. "Google Drive" -- tells a viewer
// where a link goes before they click it.
export function videoSourceLabel(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "");
    if (host === "drive.google.com") return "Google Drive";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "YouTube";
    if (host === "loom.com") return "Loom";
    if (host === "vimeo.com") return "Vimeo";
    return host;
  } catch {
    return "Link";
  }
}
