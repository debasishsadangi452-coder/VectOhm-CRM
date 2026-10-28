// Bulk-email bodies are stored and sent as HTML, but the one-off composer on
// the Bulk Email page is a plain textarea -- without this, a rep's line breaks
// and blank lines would collapse into one run-on paragraph in the delivered
// email. Already-HTML input (pasted from somewhere else) is passed through
// untouched so we never double-escape it.
export function plainTextToHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}
