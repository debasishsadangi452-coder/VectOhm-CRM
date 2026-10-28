// Shared by both outbound-email engines (bulk-email-engine.service.ts,
// sequence-engine.service.ts) so the unsubscribe footer + open-tracking
// pixel are built identically in one place instead of two near-identical
// copies that can silently drift apart.
export function appendTrackingFooter(
  bodyHtml: string,
  opts: { unsubscribeUrl: string; trackingUrl: string },
): string {
  const pixel = `<img src="${opts.trackingUrl}" width="1" height="1" style="display:none" alt="" />`;
  return `${bodyHtml}<hr style="margin-top:24px;border:none;border-top:1px solid #ddd" /><p style="font-size:11px;color:#888">Don't want these emails? <a href="${opts.unsubscribeUrl}">Unsubscribe</a></p>${pixel}`;
}
