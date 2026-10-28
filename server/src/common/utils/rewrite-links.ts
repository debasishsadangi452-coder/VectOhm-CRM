// Rewrites every real destination <a href="..."> in an HTML email body to
// route through the click-tracking redirect (tracking.controller.ts's
// /tracking/click/* routes), so a click gets recorded as an EngagementEvent
// before the recipient is bounced on to the real URL. Regex-based rather
// than a full HTML parser -- consistent with this codebase's existing
// email-tracking.ts, which is also a lightweight string transform.
export function rewriteLinksForTracking(html: string, trackingBaseUrl: string): string {
  return html.replace(/href="([^"]+)"/gi, (match, url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      // Skip mailto:, tel:, anchors -- only real http(s) destinations get
      // click-tracked. Runs before the unsubscribe footer is appended, so
      // that link is never caught here either.
      return match;
    }
    return `href="${trackingBaseUrl}?url=${encodeURIComponent(url)}"`;
  });
}
