// Same APP_URL/CORS_ORIGIN fallback chain used elsewhere to build a link back
// into this app (see indeed.adapter.ts, email-oauth.controller.ts,
// unsubscribe-token.ts).
const DEFAULT_APP_URL = "http://localhost:8080";

// Every adapter -- real or simulated -- ultimately points a candidate at our
// own public careers/apply page rather than the external board itself: we
// have no partner API to actually host a listing on most of these boards, so
// the one thing that's always true and always clickable is our own site.
// Tagging with `source` is what lets an inbound application (see
// CandidatesService.createPublicApplication) attribute itself back to
// whichever board's link the applicant actually clicked.
export function careersApplyUrl(jobId: string, source: string): string {
  let appUrl = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  // For external job board syndication (LinkedIn, Indeed, etc.), URLs must be publicly routable.
  // If APP_URL is localhost/empty, inspect CORS_ORIGIN for a public HTTPS domain.
  if (!appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    const origins = (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter((s) => s.startsWith("https://") && !s.includes("localhost"));
    if (origins.length > 0) {
      appUrl = origins.find((o) => o.includes("venushiring.com")) || origins[0];
    }
  }
  if (!appUrl) {
    appUrl = DEFAULT_APP_URL;
  }
  // Matches the frontend route file src/routes/careers.$jobId.tsx, which
  // registers as /careers/$jobId (i.e. /careers/<id>), NOT /careers/jobs/<id>.
  return `${appUrl}/careers/${jobId}?source=${source}`;
}
