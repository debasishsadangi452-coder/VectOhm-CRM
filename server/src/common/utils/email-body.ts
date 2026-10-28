// Turns what a rep typed into what a mail client should render.
//
// Bodies are authored in a plain textarea (Templates, and the Bulk Email
// one-off composer) but sent as HTML. Without this, every line break and blank
// line collapsed and the recipient got one run-on paragraph -- the message
// looked nothing like what the sender wrote.
//
// Already-HTML bodies pass through untouched, so a hand-written or pasted HTML
// template is never double-escaped.

// Block-level markup is the tell that a body was authored as HTML rather than
// typed as prose. An inline <a> or <img> on its own doesn't count: a plain-text
// body with a logo pasted in still needs its newlines converted.
const BLOCK_HTML = /<(p|div|table|ul|ol|h[1-6]|blockquote|br)\b/i;

export function isHtmlBody(body: string): boolean {
  return BLOCK_HTML.test(body);
}

export function toEmailHtml(body: string): string {
  if (isHtmlBody(body)) {
    return body;
  }
  // Escape only the characters that would break the markup, and only when we
  // are the ones generating it. `<img>`/`<a>` fragments a rep pasted in are
  // intentionally preserved rather than escaped, since escaping them would
  // show raw tags in the delivered mail.
  const escaped = body.replace(/&(?![a-z#0-9]+;)/gi, "&amp;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 1em 0">${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

// Body plus the sender's signature, separated the way a mail client would.
// The signature is appended after conversion so its own HTML is never mangled
// by the plain-text pass above.
export function composeEmailHtml(body: string, signatureHtml?: string | null): string {
  const html = toEmailHtml(body);
  if (!signatureHtml?.trim()) {
    return html;
  }
  return `${html}\n<div style="margin-top:1.5em">${signatureHtml.trim()}</div>`;
}

// ─── plain text <-> simple HTML (used so the AI can rewrite a body safely) ────

// Anything beyond paragraphs and line breaks (links, images, tables, lists, bold...) is real markup that an
// AI rewrite could damage, so such bodies are left alone.
const ONLY_P_AND_BR = /^(?:[^<]|<\/?p\b[^>]*>|<br\s*\/?>)*$/i;

/** True for plain text, or HTML that is nothing but paragraphs and line breaks (what the Bulk Email composer saves). */
export function isPlainOrSimpleHtml(body: string): boolean {
  return ONLY_P_AND_BR.test(body);
}

/** Paragraphs and line breaks back to text, with the few entities our own converter writes decoded. */
export function simpleHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*(?:<p\b[^>]*>)?/gi, "\n\n")
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
