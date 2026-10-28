import { useState } from "react";
import { Eye, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePreviewPersonalized } from "@/hooks/use-email-ai";
import { useAiAvailable } from "@/components/email-ai/ai-email-tools";

// Optional per-recipient rewrite: when on, each recipient's email is tailored by Gemini at send time (using the
// email above as the base), so a campaign doesn't read like a mass mailing. The preview shows what it would
// write for one sample recipient. If the AI is unavailable when a recipient is sent, they get the original.
export function AiPersonalizeCard({
  enabled,
  onEnabledChange,
  instructions,
  onInstructionsChange,
  subject,
  body,
  sampleRecipient,
  recipientCount,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  /** The email as written (merge fields still in it). */
  subject: string;
  body: string;
  sampleRecipient: { firstName?: string; lastName?: string; title?: string; companyName?: string; email?: string };
  recipientCount: number;
}) {
  const available = useAiAvailable();
  const preview = usePreviewPersonalized();
  const [shown, setShown] = useState<{ subject: string; body: string } | null>(null);
  const canPreview = !!subject.trim() && !!body.trim();

  const runPreview = async () => {
    try {
      setShown(
        await preview.mutateAsync({
          subject,
          body,
          recipient: sampleRecipient,
          instructions: instructions.trim() || undefined,
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI could not write a preview");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-canvas/30 p-3">
      <div
        className="flex cursor-pointer select-none items-start gap-2"
        onClick={() => available && onEnabledChange(!enabled)}
      >
        <Checkbox
          checked={enabled}
          disabled={!available}
          onCheckedChange={(checked) => onEnabledChange(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
        <span className="text-[11px] leading-snug">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5 text-amber-500" /> Personalise each email with AI
          </span>
          <span className="block text-[10px] text-text-dim">
            {available
              ? `Gemini rewrites the opening of every recipient's email for their role and company, so ${recipientCount > 1 ? "they" : "it"} don't all read the same. Takes a little longer to send.`
              : "AI isn't set up yet. Ask an Admin to add the Gemini key."}
          </span>
        </span>
      </div>

      {enabled && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-instructions" className="text-[11px]">
              Guidance for the AI (optional)
            </Label>
            <Textarea
              id="ai-instructions"
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="e.g. We place Java and Python developers. Keep it short. Don't mention pricing."
              rows={2}
              maxLength={1000}
              className="text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={runPreview}
              disabled={!canPreview || preview.isPending}
              title={!canPreview ? "Write the subject and body first" : undefined}
            >
              {preview.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
              Preview for a sample recipient
            </Button>
            <span className="text-[10px] text-text-dim">
              Uses {sampleRecipient.firstName || "a sample recipient"}
              {sampleRecipient.companyName ? ` at ${sampleRecipient.companyName}` : ""}.
            </span>
          </div>
          {shown && (
            <div className="rounded-md border border-border-subtle bg-panel p-3 text-xs">
              <p className="border-b border-border-subtle pb-1.5 font-semibold">{shown.subject}</p>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{shown.body}</p>
              <p className="mt-2 text-[10px] text-text-dim">
                Each recipient gets their own version, so wording will differ. Nothing is sent from this preview.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
