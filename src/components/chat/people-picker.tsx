import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UserSummary } from "@/lib/api/types";
import { getInitials } from "@/lib/utils";

// Pick any number of colleagues: search by name, tick people, or add a whole department with one click.
// Selected people show as chips above the list.
export function PeoplePicker({
  people,
  selectedIds,
  onChange,
  disabledIds = [],
  height = "h-64",
}: {
  people: UserSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Shown but not selectable (for example people already in the group). */
  disabledIds?: string[];
  height?: string;
}) {
  const [query, setQuery] = useState("");
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) =>
        !q ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (p.department?.name ?? "").toLowerCase().includes(q),
    );
  }, [people, query]);

  const departments = useMemo(() => {
    const map = new Map<string, { name: string; ids: string[] }>();
    for (const p of people) {
      if (!p.department || disabled.has(p.id)) continue;
      const entry = map.get(p.department.id) ?? { name: p.department.name, ids: [] };
      entry.ids.push(p.id);
      map.set(p.department.id, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people, disabled]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const addAll = (ids: string[]) => onChange(Array.from(new Set([...selectedIds, ...ids])));

  const chosen = people.filter((p) => selected.has(p.id));

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] font-medium text-primary"
            >
              {p.firstName} {p.lastName}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label={`Remove ${p.firstName} ${p.lastName}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-text-dim" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or a department…"
          className="pl-9 text-xs"
        />
      </div>

      {departments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-dim">Add whole team:</span>
          {departments.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => addAll(d.ids)}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-dim hover:border-primary hover:text-primary"
            >
              {d.name} ({d.ids.length})
            </button>
          ))}
        </div>
      )}

      <ScrollArea className={`${height} rounded-lg border border-border-subtle bg-panel-elevated`}>
        <div className="p-1">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-dim">No one matches your search.</p>
          ) : (
            visible.map((p) => {
              const isDisabled = disabled.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-xs ${
                    isDisabled ? "opacity-50" : "cursor-pointer hover:bg-panel"
                  }`}
                >
                  <Checkbox
                    checked={isDisabled || selected.has(p.id)}
                    disabled={isDisabled}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <Avatar className="size-7 bg-primary/10">
                    <AvatarFallback className="text-[10px]">{getInitials(p)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium">
                    {p.firstName} {p.lastName}
                    {isDisabled && <span className="ml-1.5 font-normal text-text-dim">already in the group</span>}
                  </span>
                  {p.department && (
                    <span className="rounded bg-panel px-1.5 py-0.5 text-[9px] text-text-dim">{p.department.name}</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
