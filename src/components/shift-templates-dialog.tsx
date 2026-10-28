import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useApplyShiftTemplate,
  useCreateShiftTemplate,
  useDeleteShiftTemplate,
  useShiftTemplates,
} from "@/hooks/use-work-session";
import { useUsers } from "@/hooks/use-users";
import { filterPeople } from "@/lib/shift-templates";
import { ALL } from "@/lib/attendance-view";

/**
 * Reusable working hours ("9-6 Sales"): create them once, then apply one to many
 * people at a time instead of typing the same two times into every account.
 */
export function ShiftTemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: templates, isLoading } = useShiftTemplates(open);
  const { data: users } = useUsers(open);
  const create = useCreateShiftTemplate();
  const remove = useDeleteShiftTemplate();
  const apply = useApplyShiftTemplate();

  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  const [templateId, setTemplateId] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(ALL);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);

  const people = useMemo(() => filterPeople(users ?? [], { search, department }), [users, search, department]);
  const departments = useMemo(
    () => Array.from(new Set((users ?? []).map((u) => u.department?.name).filter(Boolean) as string[])).sort(),
    [users],
  );
  const chosen = templates?.find((t) => t.id === templateId);
  const allShownPicked = people.length > 0 && people.every((p) => picked.has(p.id));
  const canAdd = name.trim().length > 0 && start !== end && !create.isPending;

  function toggle(id: string) {
    setResult(null);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setResult(null);
    setPicked((s) => {
      const next = new Set(s);
      for (const p of people) {
        if (allShownPicked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    create.mutate({ name: name.trim(), shiftStart: start, shiftEnd: end }, { onSuccess: () => setName("") });
  }

  function applyNow() {
    if (!chosen || picked.size === 0) return;
    apply.mutate(
      { id: chosen.id, userIds: Array.from(picked) },
      {
        onSuccess: (r) => {
          setResult(`${r.updated} ${r.updated === 1 ? "person" : "people"} now work ${r.shiftStart}–${r.shiftEnd}.`);
          setPicked(new Set());
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Shift templates</DialogTitle>
          <DialogDescription>
            Save a set of working hours once and apply it to as many people as you like. Applying copies the times, so changing a
            template later doesn't change anyone's hours.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Templates</h3>
          <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {isLoading && (
              <div className="grid place-items-center py-5 text-text-dim">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!isLoading && (templates?.length ?? 0) === 0 && (
              <p className="py-5 text-center text-sm text-text-dim">No templates yet — add one below.</p>
            )}
            {templates?.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 font-mono text-xs text-text-dim">
                    {t.shiftStart}–{t.shiftEnd}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-text-dim hover:text-destructive"
                  title={`Delete ${t.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(t.id);
                    if (templateId === t.id) setTemplateId("");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <form onSubmit={addTemplate} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[150px] flex-1 space-y-1">
              <Label htmlFor="tpl-name" className="text-xs">Name</Label>
              <Input id="tpl-name" value={name} maxLength={60} placeholder="e.g. 9–6 Sales" onChange={(e) => setName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-start" className="text-xs">Log in</Label>
              <Input id="tpl-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[110px] font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-end" className="text-xs">Log out</Label>
              <Input id="tpl-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[110px] font-mono text-xs" />
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={!canAdd}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
            </Button>
          </form>
          {create.isError && <p className="text-xs text-destructive">{(create.error as Error)?.message || "Could not add the template."}</p>}
          {remove.isError && <p className="text-xs text-destructive">{(remove.error as Error)?.message || "Could not delete the template."}</p>}
        </section>

        {(templates?.length ?? 0) > 0 && (
          <section className="space-y-3 border-t border-border-subtle pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Apply to people</h3>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={templateId} onValueChange={(v) => (setTemplateId(v), setResult(null))}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates!.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.shiftStart}–{t.shiftEnd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-9 w-[170px]" />
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-[240px] overflow-y-auto rounded-lg border border-border-subtle">
              <label className="flex cursor-pointer items-center gap-3 border-b border-border-subtle bg-muted/40 px-3 py-2 text-xs font-medium">
                <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} aria-label="Select everyone shown" />
                Select everyone shown ({people.length})
              </label>
              {people.length === 0 && <p className="py-5 text-center text-sm text-text-dim">Nobody matches.</p>}
              {people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-hover">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.firstName} ${p.lastName}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.firstName} {p.lastName}
                    <span className="ml-2 text-xs text-text-dim">{p.department?.name ?? "No department"}</span>
                  </span>
                  <span className="font-mono text-xs text-text-dim">
                    {p.shiftStart ?? "10:00"}–{p.shiftEnd ?? "19:00"}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={applyNow} disabled={!chosen || picked.size === 0 || apply.isPending}>
                {apply.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {chosen ? `Apply ${chosen.shiftStart}–${chosen.shiftEnd} to ${picked.size} ${picked.size === 1 ? "person" : "people"}` : "Choose a template"}
              </Button>
              {result && <span className="text-sm text-emerald-600">{result}</span>}
            </div>
            {apply.isError && <p className="text-xs text-destructive">{(apply.error as Error)?.message || "Could not apply the template."}</p>}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
