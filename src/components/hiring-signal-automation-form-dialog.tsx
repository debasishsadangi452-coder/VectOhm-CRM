import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateHiringSignalAutomation,
  useUpdateHiringSignalAutomation,
  useDeleteHiringSignalAutomation,
} from "@/hooks/use-hiring-signals";
import { useSequences } from "@/hooks/use-sequences";
import type { HiringSignalAutomation } from "@/lib/api/hiring-signals";

interface HiringSignalAutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: HiringSignalAutomation;
}

function commaList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function HiringSignalAutomationFormDialog({
  open,
  onOpenChange,
  automation,
}: HiringSignalAutomationFormDialogProps) {
  const isEdit = !!automation;
  const { data: sequences } = useSequences();
  const createAutomation = useCreateHiringSignalAutomation();
  const updateAutomation = useUpdateHiringSignalAutomation();
  const deleteAutomation = useDeleteHiringSignalAutomation();

  const [name, setName] = useState("");
  const [industries, setIndustries] = useState("");
  const [locations, setLocations] = useState("");
  const [keywords, setKeywords] = useState("");
  const [adzunaEnabled, setAdzunaEnabled] = useState(false);
  const [adzunaRoleKeywords, setAdzunaRoleKeywords] = useState("");
  const [targetTitles, setTargetTitles] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(automation?.name ?? "");
    setIndustries(automation?.industries.join(", ") ?? "");
    setLocations(automation?.locations.join(", ") ?? "");
    setKeywords(automation?.keywords ?? "");
    setAdzunaEnabled(automation?.adzunaEnabled ?? false);
    setAdzunaRoleKeywords(automation?.adzunaRoleKeywords.join(", ") ?? "");
    setTargetTitles(automation?.targetTitles.join(", ") ?? "");
    setSequenceId(automation?.sequenceId ?? "");
    setError(null);
  }, [open, automation]);

  const saving = createAutomation.isPending || updateAutomation.isPending;
  const deleting = deleteAutomation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      industries: commaList(industries) ?? [],
      locations: commaList(locations) ?? [],
      keywords: keywords || undefined,
      adzunaEnabled,
      adzunaRoleKeywords: commaList(adzunaRoleKeywords) ?? [],
      targetTitles: commaList(targetTitles),
      sequenceId,
    };
    try {
      if (isEdit && automation) {
        await updateAutomation.mutateAsync({ id: automation.id, input });
      } else {
        await createAutomation.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      setError("Could not save automation");
    }
  }

  async function handleDelete() {
    if (!automation) return;
    try {
      await deleteAutomation.mutateAsync(automation.id);
      onOpenChange(false);
    } catch {
      setError("Could not delete automation");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit hiring signal automation" : "New hiring signal automation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="hsa-name">Name</Label>
            <Input id="hsa-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hsa-industries">Industries (comma-separated)</Label>
            <Input
              id="hsa-industries"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="e.g. Software, Fintech"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hsa-locations">Locations (comma-separated)</Label>
            <Input
              id="hsa-locations"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              placeholder="e.g. United States, Canada"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hsa-keywords">Keywords</Label>
            <Input
              id="hsa-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. Series B SaaS"
            />
            <p className="text-[10px] text-text-dim">
              Used with Apollo's company search to find candidate accounts matching your ICP.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border-subtle pt-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hsa-adzuna"
                checked={adzunaEnabled}
                onCheckedChange={(v) => setAdzunaEnabled(v === true)}
              />
              <Label htmlFor="hsa-adzuna" className="text-sm font-normal">
                Also discover companies via Adzuna's open job market (needs your own Adzuna API key
                configured on the server)
              </Label>
            </div>
            {adzunaEnabled && (
              <Input
                value={adzunaRoleKeywords}
                onChange={(e) => setAdzunaRoleKeywords(e.target.value)}
                placeholder="Role keywords, e.g. Software Engineer, Account Executive"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hsa-titles">Target titles (comma-separated)</Label>
            <Input
              id="hsa-titles"
              value={targetTitles}
              onChange={(e) => setTargetTitles(e.target.value)}
              placeholder="Defaults to VP/Head/Director of Talent Acquisition, CEO, Founder…"
            />
            <p className="text-[10px] text-text-dim">
              Who counts as a valid decision-maker to enroll -- leave blank to use the built-in default list.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Enroll into sequence</Label>
            <Select value={sequenceId} onValueChange={setSequenceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a sequence" />
              </SelectTrigger>
              <SelectContent>
                {sequences?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-text-dim">
              Up to 2 real decision-makers per company get enrolled here automatically.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={saving || !sequenceId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Save changes" : "Create automation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
