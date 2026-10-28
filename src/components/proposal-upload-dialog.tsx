import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadDealDocument } from "@/hooks/use-deal-documents";
import { formatFileSize } from "@/lib/format-file-size";

// Mirrors ALLOWED_MIME_TYPES in deal-documents.controller.ts.
const ACCEPTED =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 25 * 1024 * 1024; // keep in step with MAX_DOCUMENT_BYTES on the server

interface ProposalUploadDialogProps {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Set when the dialog was raised automatically by a move into Proposal Sent,
  // rather than by the user clicking Attach.
  prompted?: boolean;
}

export function ProposalUploadDialog({
  dealId,
  open,
  onOpenChange,
  prompted,
}: ProposalUploadDialogProps) {
  const upload = useUploadDealDocument(dealId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setNote("");
    setError(null);
  }, [open]);

  function handleFileChange(selected: File | null) {
    setError(null);
    if (selected && selected.size > MAX_BYTES) {
      setError(`That file is ${formatFileSize(selected.size)} — the limit is 25 MB.`);
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose the proposal file to attach.");
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync({ file, note: note.trim() || undefined });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not attach this file");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !upload.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {prompted ? "Attach the proposal you sent" : "Attach a proposal"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {prompted && (
            <p className="text-sm text-text-dim">
              This deal just moved to <span className="text-foreground">Proposal Sent</span>. Attach
              the document that went to the customer so there's a record of exactly what was quoted.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Proposal file</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border-subtle bg-panel-elevated/40 px-3 py-4 text-left transition-colors hover:bg-panel-elevated disabled:opacity-60"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                {file ? <FileText className="size-4" /> : <Upload className="size-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {file ? file.name : "Choose a PDF or Word file"}
                </p>
                <p className="text-xs text-text-dim">
                  {file ? formatFileSize(file.size) : "PDF or .docx · up to 25 MB"}
                </p>
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-note">Note (optional)</Label>
            <Input
              id="proposal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. v2 with revised freight terms"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={upload.isPending}
            >
              {prompted ? "Not now" : "Cancel"}
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending && <Loader2 className="size-4 animate-spin" />}
              Attach proposal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
