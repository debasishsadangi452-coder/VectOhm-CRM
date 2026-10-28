import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateEmailTemplate } from "@/hooks/use-email-ai";
import type { GenerateTemplateInput } from "@/lib/api/email-ai";

export const AI_TONES = ["Friendly and professional", "Warm and conversational", "Formal and polished", "Short and direct", "Confident and persuasive"];
export const AI_LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Arabic", "Portuguese"];

export interface GeneratedTemplate {
  name: string;
  subject: string;
  body: string;
}

// "Write with AI": describe what the email is for and Gemini drafts a reusable template with merge fields. The
// person reads it, can regenerate, and only then uses it; nothing is saved or sent from here.
export function AiTemplateWriterDialog({
  open,
  onOpenChange,
  onUse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (draft: GeneratedTemplate) => void;
}) {
  const generate = useGenerateEmailTemplate();
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState(AI_TONES[0]);
  const [language, setLanguage] = useState("English");
  const [length, setLength] = useState<NonNullable<GenerateTemplateInput["length"]>>("medium");
  const [draft, setDraft] = useState<GeneratedTemplate | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(null);
      generate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async () => {
    if (!goal.trim()) return;
    try {
      setDraft(
        await generate.mutateAsync({
          goal: goal.trim(),
          audience: audience.trim() || undefined,
          tone,
          language,
          length,
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI could not write that email");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" /> Write a template with AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Describe the email and Gemini drafts a reusable template. It uses merge fields like{" "}
            <code>{"{{firstName}}"}</code>, so each recipient gets their own details. You can edit it before saving.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ai-goal">What is this email for?</Label>
              <Textarea
                id="ai-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Introduce our IT staffing service to HR heads and offer a short call"
                rows={3}
                maxLength={1000}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-audience">Who is it going to? (optional)</Label>
              <Input
                id="ai-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. HR managers at mid-size software companies"
                maxLength={300}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_TONES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Length</Label>
                <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short" className="text-xs">Short</SelectItem>
                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="long" className="text-xs">Longer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border-subtle bg-canvas/40 p-3 text-sm">
              <p className="mb-2 text-[11px] text-text-dim">Template name: {draft.name}</p>
              <p className="border-b border-border-subtle pb-2 font-semibold">{draft.subject}</p>
              <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed">{draft.body}</p>
            </div>
            <p className="text-[11px] text-text-dim">
              Read it through before you use it. The AI can get details wrong, and it only knows what you told it.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {draft ? (
            <Button type="button" variant="outline" onClick={run} disabled={generate.isPending} className="gap-1.5">
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Try again
            </Button>
          ) : (
            <span />
          )}
          {draft ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Change request
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onUse(draft);
                  onOpenChange(false);
                }}
              >
                Use this template
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={run} disabled={!goal.trim() || generate.isPending} className="gap-1.5">
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Write it
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
