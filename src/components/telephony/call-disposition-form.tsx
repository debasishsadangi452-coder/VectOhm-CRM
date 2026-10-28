import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateCallDisposition } from "@/hooks/use-telephony";
import { CALL_DISPOSITIONS } from "@/lib/api/types";

// Shown inline in GlobalCallWidget the moment call-ended fires -- how did
// the call go, per the plan's §7. Skippable: a rep who just wants to move on
// isn't blocked from closing the widget without filling this in.
export function CallDispositionForm({ callId, onDone }: { callId: string; onDone: () => void }) {
  const updateDisposition = useUpdateCallDisposition();
  const [disposition, setDisposition] = useState<string>("");
  const [notes, setNotes] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateDisposition.mutateAsync({
      id: callId,
      input: { disposition: disposition || undefined, notes: notes || undefined },
    });
    onDone();
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 border-t border-border-subtle pt-3">
      <p className="text-xs font-medium text-text-dim">How did the call go?</p>
      <Select value={disposition} onValueChange={setDisposition}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select an outcome" />
        </SelectTrigger>
        <SelectContent>
          {CALL_DISPOSITIONS.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="text-xs min-h-16"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Skip
        </Button>
        <Button type="submit" size="sm" disabled={updateDisposition.isPending}>
          {updateDisposition.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
