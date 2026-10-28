import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import {
  useDeleteSignatureImage,
  useSaveSignature,
  useSignature,
  useSignatureImages,
  useUploadSignatureImage,
} from "@/hooks/use-email-signature";
import { formatFileSize } from "@/lib/format-file-size";

const ACCEPTED = "image/png,image/jpeg,image/gif,image/webp";

// Dropped in when a signature is empty, so the first-time experience isn't a
// blank box and an HTML tutorial.
const STARTER = `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#333">
  <strong>Your Name</strong><br />
  Sales Manager · Venus Global Tech<br />
  <a href="mailto:you@company.com">you@company.com</a> · +1 555 000 1234
</p>`;

export function EmailSignatureEditor() {
  const { data: signature, isLoading } = useSignature();
  const { data: images } = useSignatureImages();
  const save = useSaveSignature();
  const upload = useUploadSignatureImage();
  const deleteImage = useDeleteSignatureImage();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (signature) setHtml(signature.html ?? "");
  }, [signature]);

  // Inserts at the caret so a logo can go above or below the text block.
  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? html.length;
    const end = el?.selectionEnd ?? html.length;
    setHtml(html.slice(0, start) + snippet + html.slice(end));
    setSaved(false);
    el?.focus();
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const image = await upload.mutateAsync(file);
      // Width-capped: mail clients render a full-size logo enormous otherwise.
      insertAtCursor(
        `\n<img src="${image.url}" alt="" width="140" style="max-width:140px;height:auto;border:0" />\n`,
      );
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not upload that image");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync(html.trim() || null);
      setSaved(true);
    } catch {
      setError("Could not save your signature");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-text-dim">
        <Loader2 className="size-4 animate-spin" /> Loading signature…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="signature-html">Signature</Label>
            <div className="flex items-center gap-1.5">
              {!html.trim() && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setHtml(STARTER)}>
                  Use starter
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Add image
              </Button>
            </div>
          </div>
          <Textarea
            id="signature-html"
            ref={textareaRef}
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setSaved(false);
            }}
            rows={12}
            className="font-mono text-xs"
            placeholder="Your name, title, phone — plain text or HTML."
          />
          <p className="text-[10px] text-text-dim">
            Plain text works; HTML gives you links and layout. “Add image” uploads a logo and drops
            an <code>&lt;img&gt;</code> tag in at your cursor.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Preview</Label>
          <EmailHtmlPreview
            html={html || '<span style="color:#888">Nothing yet.</span>'}
            className="h-[268px]"
            title="Signature preview"
          />
        </div>
      </div>

      {images && images.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-text-dim">Uploaded images</Label>
          <div className="flex flex-wrap gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5"
              >
                <img src={image.url} alt="" className="size-6 rounded object-contain" />
                <div className="min-w-0">
                  <p className="max-w-[140px] truncate text-[11px]">{image.originalName}</p>
                  <p className="font-mono text-[9px] text-text-dim">
                    {formatFileSize(image.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      `\n<img src="${image.url}" alt="" width="140" style="max-width:140px;height:auto;border:0" />\n`,
                    )
                  }
                  className="text-[10px] text-primary hover:underline"
                >
                  insert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete ${image.originalName}? Emails already sent will break.`))
                      return;
                    deleteImage.mutate(image.id);
                  }}
                  disabled={deleteImage.isPending}
                  className="text-text-dim transition-colors hover:text-destructive"
                  aria-label="Delete image"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          Save signature
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
