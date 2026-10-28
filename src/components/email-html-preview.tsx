// Renders email HTML the way a mail client would, inside a sandboxed iframe.
//
// Deliberately NOT dangerouslySetInnerHTML: templates are a shared team
// resource (any Sales member can edit any template), so one user's markup ends
// up rendered in another user's browser. An empty `sandbox` attribute applies
// every restriction -- no scripts, no forms, no same-origin access -- while
// still letting images and styling through, which is exactly what a signature
// preview needs.
interface EmailHtmlPreviewProps {
  html: string;
  className?: string;
  title?: string;
}

export function EmailHtmlPreview({
  html,
  className = "",
  title = "Email preview",
}: EmailHtmlPreviewProps) {
  // The iframe is its own document, so it inherits none of the app's dark
  // theme -- give it a white page like a real mail client.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 12px; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
           font-size: 13px; line-height: 1.5; color: #1d1d1f; background: #ffffff;
           word-break: break-word; }
    img { max-width: 100%; height: auto; }
    a { color: #0066cc; }
  </style></head><body>${html}</body></html>`;

  return (
    <iframe
      sandbox=""
      srcDoc={doc}
      title={title}
      className={`w-full rounded-md border border-border-subtle bg-white ${className}`}
    />
  );
}
