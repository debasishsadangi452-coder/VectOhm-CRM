import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAttendanceSettings,
  useClearDepartmentPolicy,
  useSetDepartmentPolicy,
  useUpdateAttendanceSettings,
} from "@/hooks/use-work-session";
import { parseWholeNumber, policyToDraft, draftToPatch, validateDraft, type PolicyDraft } from "@/lib/attendance-rules";
import { formatDuration } from "@/lib/attendance-view";
import type { DeptPolicyField } from "@/lib/api/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEPT_FIELDS: Array<{ key: DeptPolicyField; label: string; unit: string }> = [
  { key: "lateGraceMin", label: "Late grace", unit: "min" },
  { key: "earlyGraceMin", label: "Early-leave grace", unit: "min" },
  { key: "idlePromptMin", label: "Idle prompt after", unit: "min" },
  { key: "absentAfterMin", label: "Absent after", unit: "min" },
  { key: "minWorkMinutes", label: "Minimum per day", unit: "min" },
];

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  suffix,
  step = 1,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  suffix: string;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`h-9 w-28 ${error ? "border-destructive" : ""}`}
        />
        <span className="text-xs text-text-dim">{suffix}</span>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Admin / HR edit the attendance rules (grace periods, idle limit, minimum hours,
 * weekly days off, ...) instead of needing a code change, and can give a
 * department its own values for the rules that make sense per team.
 */
export function AttendanceRulesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: view, isLoading } = useAttendanceSettings(open);
  const update = useUpdateAttendanceSettings();
  const setDept = useSetDepartmentPolicy();
  const clearDept = useClearDepartmentPolicy();

  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [saved, setSaved] = useState(false);

  // Load the stored rules into the form each time the sheet opens (and after a save).
  useEffect(() => {
    if (view) setDraft(policyToDraft(view.global));
  }, [view]);
  useEffect(() => {
    if (!open) setSaved(false);
  }, [open]);

  const errors = useMemo(() => (draft && view ? validateDraft(draft, view.limits) : {}), [draft, view]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = useMemo(
    () => !!draft && !!view && JSON.stringify(draft) !== JSON.stringify(policyToDraft(view.global)),
    [draft, view],
  );

  const set = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  function save() {
    if (!draft || hasErrors) return;
    update.mutate(draftToPatch(draft), { onSuccess: () => setSaved(true) });
  }

  // ── department overrides ──
  const [deptId, setDeptId] = useState<string>("");
  const [deptDraft, setDeptDraft] = useState<Record<DeptPolicyField, string>>(emptyDept());
  const existing = view?.overrides.find((o) => o.departmentId === deptId);

  useEffect(() => {
    setDeptDraft(
      existing
        ? (Object.fromEntries(DEPT_FIELDS.map((f) => [f.key, existing[f.key] == null ? "" : String(existing[f.key])])) as Record<DeptPolicyField, string>)
        : emptyDept(),
    );
  }, [deptId, existing]);

  const deptErrors = useMemo(() => {
    const out: Partial<Record<DeptPolicyField, string>> = {};
    for (const f of DEPT_FIELDS) {
      const raw = deptDraft[f.key].trim();
      if (!raw) continue;
      const n = parseWholeNumber(raw);
      const [min, max] = view?.limits[f.key] ?? [0, 100000];
      if (n == null || n < min || n > max) out[f.key] = `${min}–${max}`;
    }
    return out;
  }, [deptDraft, view]);

  function saveDept() {
    if (!deptId || Object.keys(deptErrors).length) return;
    const patch: Partial<Record<DeptPolicyField, number | null>> = {};
    for (const f of DEPT_FIELDS) {
      const raw = deptDraft[f.key].trim();
      patch[f.key] = raw ? parseWholeNumber(raw) : null; // blank = back to the company value
    }
    setDept.mutate({ departmentId: deptId, patch });
  }

  const serverError =
    (update.isError && ((update.error as Error)?.message || "Couldn't save.")) ||
    (setDept.isError && ((setDept.error as Error)?.message || "Couldn't save.")) ||
    (clearDept.isError && ((clearDept.error as Error)?.message || "Couldn't remove.")) ||
    null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Attendance rules</SheetTitle>
          <SheetDescription>
            These apply to everyone straight away. Changing a rule doesn't rewrite the past: sessions already recorded keep how they were judged.
          </SheetDescription>
        </SheetHeader>

        {isLoading || !draft || !view ? (
          <div className="grid place-items-center py-16 text-text-dim">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            <Section title="Late arrivals and early leaving">
              <NumberField id="r-late" label="Late grace period" suffix="minutes after shift start" value={draft.lateGraceMin} onChange={(v) => set("lateGraceMin", v)} error={errors.lateGraceMin} hint={`Default ${view.defaults.lateGraceMin}`} />
              <NumberField id="r-early" label="Early-leave grace" suffix="minutes before shift end" value={draft.earlyGraceMin} onChange={(v) => set("earlyGraceMin", v)} error={errors.earlyGraceMin} hint={`Default ${view.defaults.earlyGraceMin}`} />
            </Section>

            <Section title="Idle time">
              <NumberField id="r-idle" label="Ask why after" suffix="minutes with no keyboard or mouse input" value={draft.idlePromptMin} onChange={(v) => set("idlePromptMin", v)} error={errors.idlePromptMin} hint={`Default ${view.defaults.idlePromptMin}`} />
            </Section>

            <Section title="Absence">
              <NumberField id="r-absent" label="Mark absent after" suffix="minutes past shift start" value={draft.absentAfterMin} onChange={(v) => set("absentAfterMin", v)} error={errors.absentAfterMin} hint={`Default ${view.defaults.absentAfterMin}`} />
              <div className="space-y-1">
                <Label htmlFor="r-track" className="text-xs font-medium">Count absences from</Label>
                <Input id="r-track" type="date" value={draft.absenceTrackingStart} onChange={(e) => set("absenceTrackingStart", e.target.value)} className={`h-9 w-44 ${errors.absenceTrackingStart ? "border-destructive" : ""}`} />
                <p className="text-xs text-text-dim">
                  {errors.absenceTrackingStart ?? "Days before this are never marked absent or short. Leave empty to judge every day."}
                </p>
              </div>
            </Section>

            <Section title="Hours">
              <NumberField
                id="r-min"
                label="Minimum worked per working day"
                suffix="hours"
                step={0.25}
                value={draft.minWorkHours}
                onChange={(v) => set("minWorkHours", v)}
                error={errors.minWorkMinutes}
                hint={`Default ${formatDuration(view.defaults.minWorkMinutes)}. Less than this is a "short day".`}
              />
            </Section>

            <Section title="Forgotten clock-outs">
              <NumberField id="r-max" label="Close a session left open for" suffix="hours" value={draft.maxOpenSessionHours} onChange={(v) => set("maxOpenSessionHours", v)} error={errors.maxOpenSessionHours} hint={`Default ${view.defaults.maxOpenSessionHours}`} />
            </Section>

            <Section title="Repeated lateness alert">
              <NumberField id="r-rep" label="Alert manager and HR at" suffix="late arrivals" value={draft.repeatLateThreshold} onChange={(v) => set("repeatLateThreshold", v)} error={errors.repeatLateThreshold} hint={`Default ${view.defaults.repeatLateThreshold}`} />
              <NumberField id="r-win" label="...within" suffix="days" value={draft.repeatLateWindowDays} onChange={(v) => set("repeatLateWindowDays", v)} error={errors.repeatLateWindowDays} hint={`Default ${view.defaults.repeatLateWindowDays}`} />
            </Section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Weekly days off</h3>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((name, day) => {
                  const off = draft.weeklyOffDays.includes(day);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={off}
                      onClick={() =>
                        set("weeklyOffDays", off ? draft.weeklyOffDays.filter((d) => d !== day) : [...draft.weeklyOffDays, day].sort())
                      }
                      className={`h-9 w-14 rounded-md border text-sm font-medium transition ${
                        off ? "border-primary bg-primary/10 text-primary" : "border-border-subtle text-text-dim hover:bg-hover"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {errors.weeklyOffDays && <p className="text-xs text-destructive">{errors.weeklyOffDays}</p>}
              <p className="text-xs text-text-dim">Highlighted days are days off: nobody is marked late, absent or short on them.</p>
            </section>

            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
              <Button onClick={save} disabled={!dirty || hasErrors || update.isPending}>
                {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save rules
              </Button>
              <Button variant="outline" onClick={() => setDraft(policyToDraft(view.defaults))} className="gap-1.5">
                <RotateCcw className="size-3.5" />
                Fill in defaults
              </Button>
              {saved && !dirty && <span className="text-sm text-emerald-600">Saved.</span>}
            </div>

            {/* Department overrides */}
            <section className="space-y-3 border-t border-border-subtle pt-5">
              <div>
                <h3 className="text-sm font-semibold">Department differences</h3>
                <p className="text-xs text-text-dim">
                  Give one department its own value for a rule. Anything you leave blank uses the company value above.
                </p>
              </div>

              {view.overrides.length > 0 && (
                <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle text-sm">
                  {view.overrides.map((o) => (
                    <li key={o.departmentId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <button type="button" className="min-w-0 text-left" onClick={() => setDeptId(o.departmentId)}>
                        <div className="font-medium">{o.departmentName}</div>
                        <div className="truncate text-xs text-text-dim">
                          {DEPT_FIELDS.filter((f) => o[f.key] != null)
                            .map((f) => `${f.label} ${o[f.key]} ${f.unit}`)
                            .join(" · ") || "No differences"}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-text-dim hover:text-destructive"
                        title={`Remove ${o.departmentName}'s differences`}
                        disabled={clearDept.isPending}
                        onClick={() => {
                          clearDept.mutate(o.departmentId);
                          if (deptId === o.departmentId) setDeptId("");
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 rounded-lg border border-border-subtle p-3">
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue placeholder="Choose a department…" />
                  </SelectTrigger>
                  <SelectContent>
                    {view.departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {deptId && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {DEPT_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1">
                          <Label htmlFor={`d-${f.key}`} className="text-xs font-medium">{f.label}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`d-${f.key}`}
                              type="number"
                              value={deptDraft[f.key]}
                              placeholder={String(view.global[f.key])}
                              onChange={(e) => setDeptDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                              className={`h-9 w-28 ${deptErrors[f.key] ? "border-destructive" : ""}`}
                            />
                            <span className="text-xs text-text-dim">{f.unit}</span>
                          </div>
                          {deptErrors[f.key] && <p className="text-xs text-destructive">Use {deptErrors[f.key]}</p>}
                        </div>
                      ))}
                    </div>
                    <Button size="sm" onClick={saveDept} disabled={setDept.isPending || Object.keys(deptErrors).length > 0}>
                      {setDept.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                      Save for this department
                    </Button>
                  </>
                )}
              </div>
            </section>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function emptyDept(): Record<DeptPolicyField, string> {
  return { lateGraceMin: "", earlyGraceMin: "", idlePromptMin: "", absentAfterMin: "", minWorkMinutes: "" };
}
