import { LayoutGrid, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GROUP_LABELS,
  MODULES,
  SELECTABLE_MODULES,
  defaultModuleKeys,
  type ModuleGroup,
} from "@/lib/modules";

const GROUPS: ModuleGroup[] = ["CORE", "SPRINTS", "WORKSPACE"];

// Which modules a person can open. Either the default for their role and department, or a list an Admin
// ticks by hand (and can change at any time). Admin accounts always have everything.
export function ModuleAccessCard({
  customized,
  onCustomizedChange,
  selected,
  onSelectedChange,
  role,
  departmentName,
}: {
  customized: boolean;
  onCustomizedChange: (customized: boolean) => void;
  selected: string[];
  onSelectedChange: (keys: string[]) => void;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  departmentName?: string | null;
}) {
  const isAdminAccount = role === "ADMIN";
  const defaults = defaultModuleKeys({ role: { name: role }, department: departmentName ? { name: departmentName } : null });
  const chosen = new Set(selected);

  const toggle = (key: string) =>
    onSelectedChange(chosen.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const switchTo = (custom: boolean) => {
    // Starting a custom list from what they have now means nothing disappears by surprise.
    if (custom && !customized && selected.length === 0) onSelectedChange(defaults);
    onCustomizedChange(custom);
  };

  const lockedAlways = MODULES.filter((m) => m.lock === "always");
  const lockedByRole = MODULES.filter((m) => m.lock === "role");

  return (
    <div className="rounded-2xl border border-border-subtle bg-panel p-5 space-y-4 shadow-2xs">
      <div className="flex items-start gap-2">
        <LayoutGrid className="mt-0.5 size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Module access</h3>
          <p className="text-xs text-text-dim">
            Choose which modules this person can open and work in. You can add or remove modules later.
          </p>
        </div>
      </div>

      {isAdminAccount ? (
        <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-text-dim">
          Admin accounts always have every module.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { custom: false, title: "Default", hint: "Whatever their role and department normally get." },
              { custom: true, title: "Choose modules", hint: "Pick exactly which modules they have." },
            ].map((opt) => (
              <button
                key={opt.title}
                type="button"
                onClick={() => switchTo(opt.custom)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  customized === opt.custom ? "border-primary bg-primary/5" : "border-border-subtle hover:border-primary/40"
                }`}
              >
                <div className="text-xs font-semibold">{opt.title}</div>
                <div className="text-[11px] text-text-dim">{opt.hint}</div>
              </button>
            ))}
          </div>

          {customized ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-text-dim">{selected.length} selected</span>
                <button type="button" className="text-primary hover:underline" onClick={() => onSelectedChange(defaults)}>
                  Start from default
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onSelectedChange(SELECTABLE_MODULES.map((m) => m.key))}
                >
                  Select all
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => onSelectedChange([])}>
                  Clear
                </button>
              </div>

              {GROUPS.map((group) => {
                const items = SELECTABLE_MODULES.filter((m) => m.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                      {GROUP_LABELS[group]}
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {items.map((m) => (
                        <label
                          key={m.key}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                            chosen.has(m.key) ? "border-primary/40 bg-primary/5" : "border-border-subtle hover:bg-panel-elevated"
                          }`}
                        >
                          <Checkbox checked={chosen.has(m.key)} onCheckedChange={() => toggle(m.key)} />
                          <span className="font-medium">{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">They will have</div>
              {defaults.length === 0 ? (
                <p className="text-xs text-text-dim">Only the modules everyone has.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {defaults.map((key) => (
                    <span key={key} className="rounded-full bg-panel-elevated px-2.5 py-0.5 text-[11px] font-medium">
                      {SELECTABLE_MODULES.find((m) => m.key === key)?.label ?? key}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-text-dim">
                This follows their role and department, so it changes if those change.
              </p>
            </div>
          )}

          <div className="space-y-1 border-t border-border-subtle pt-3 text-[11px] text-text-dim">
            <p className="flex items-start gap-1.5">
              <Lock className="mt-0.5 size-3 shrink-0" />
              <span>
                Always on for everyone: {lockedAlways.map((m) => m.label).join(", ")}.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <Lock className="mt-0.5 size-3 shrink-0" />
              <span>
                Set by role or department, not chosen here: {lockedByRole.map((m) => m.label).join(", ")}.
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
