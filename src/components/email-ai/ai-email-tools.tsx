import { useState } from "react";
import { ChevronDown, Lightbulb, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useEmailAiStatus, useRewriteEmail, useSuggestSubjects } from "@/hooks/use-email-ai";
import type { RewriteInstruction } from "@/lib/api/email-ai";
import { AI_LANGUAGES } from "@/components/email-ai/ai-template-writer-dialog";

const NOT_SET_UP = "AI writing isn't set up yet. Ask an Admin to add the Gemini key.";

/** True once we know the AI can work; while loading we assume it can, so buttons don't flicker disabled. */
export function useAiAvailable() {
  const { data } = useEmailAiStatus();
  return data ? data.configured : true;
}

const ACTIONS: Array<{ label: string; instruction: RewriteInstruction }> = [
  { label: "Make it shorter", instruction: "SHORTER" },
  { label: "Make it longer", instruction: "LONGER" },
  { label: "Friendlier tone", instruction: "FRIENDLIER" },
  { label: "More formal", instruction: "FORMAL" },
  { label: "Fix spelling and grammar", instruction: "FIX" },
];

// Improve what is already written. The result replaces the text right away, with an Undo in the toast, so a
// bad rewrite costs one click.
export function AiImproveMenu({
  subject,
  body,
  onApply,
  disabled,
}: {
  subject?: string;
  body: string;
  onApply: (result: { subject?: string; body: string }) => void;
  disabled?: boolean;
}) {
  const available = useAiAvailable();
  const rewrite = useRewriteEmail();
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const run = async (instruction: RewriteInstruction, extra: { language?: string; custom?: string } = {}) => {
    const before = { subject, body };
    try {
      const result = await rewrite.mutateAsync({ subject, body, instruction, ...extra });
      onApply({ subject: result.subject ?? subject, body: result.body });
      toast.success("Updated with AI", {
        action: { label: "Undo", onClick: () => onApply({ subject: before.subject, body: before.body }) },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI could not rewrite that");
    }
  };

  const isDisabled = disabled || !body.trim() || rewrite.isPending || !available;

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={isDisabled}
            title={!available ? NOT_SET_UP : !body.trim() ? "Write something first" : undefined}
          >
            {rewrite.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5 text-amber-500" />}
            Improve with AI
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {ACTIONS.map((a) => (
            <DropdownMenuItem key={a.instruction} onClick={() => run(a.instruction)} className="text-xs">
              {a.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {AI_LANGUAGES.filter((l) => l !== "English").map((l) => (
            <DropdownMenuItem key={l} onClick={() => run("TRANSLATE", { language: l })} className="text-xs">
              Translate to {l}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => run("TRANSLATE", { language: "English" })} className="text-xs">
            Translate to English
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCustomOpen((v) => !v);
            }}
            className="text-xs"
          >
            Tell the AI what to change…
          </DropdownMenuItem>
          {customOpen && (
            <div className="flex gap-1.5 p-2" onKeyDown={(e) => e.stopPropagation()}>
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. mention our free trial"
                className="h-8 text-xs"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={!custom.trim()}
                onClick={() => {
                  run("CUSTOM", { custom: custom.trim() });
                  setCustom("");
                  setCustomOpen(false);
                }}
              >
                Go
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// A few alternative subject lines for the current body; clicking one uses it.
export function AiSubjectSuggest({
  subject,
  body,
  onPick,
  disabled,
}: {
  subject?: string;
  body: string;
  onPick: (subject: string) => void;
  disabled?: boolean;
}) {
  const available = useAiAvailable();
  const suggest = useSuggestSubjects();
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      await suggest.mutateAsync({ subject, body, count: 4 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI could not suggest subjects");
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={disabled || !body.trim() || !available}
          title={!available ? NOT_SET_UP : !body.trim() ? "Write the body first" : undefined}
        >
          <Lightbulb className="size-3.5 text-amber-500" />
          Suggest subjects
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        {suggest.isPending ? (
          <div className="flex items-center gap-2 p-3 text-xs text-text-dim">
            <Loader2 className="size-4 animate-spin" /> Thinking of subject lines…
          </div>
        ) : suggest.data ? (
          <div className="space-y-1">
            {suggest.data.subjects.map((s) => (
              <button
                key={s}
                type="button"
                className="w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-panel-elevated"
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            ))}
            <button type="button" className="px-2.5 py-1 text-[11px] text-primary hover:underline" onClick={load}>
              More ideas
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** The "Write with AI" entry button used above a template or a one-off email. */
export function AiWriteButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const available = useAiAvailable();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 border-primary/30 bg-primary/5 text-xs font-semibold text-primary"
      onClick={onClick}
      disabled={disabled || !available}
      title={!available ? NOT_SET_UP : undefined}
    >
      <Sparkles className="size-3.5 text-amber-500" /> Write with AI
    </Button>
  );
}
