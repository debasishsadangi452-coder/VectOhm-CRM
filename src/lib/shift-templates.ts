import type { ShiftTemplate, UserSummary } from "./api/types";

/**
 * The quick-pick presets the user form offers when no templates have been
 * created yet. "Night" has shiftEnd before shiftStart on purpose -- the
 * server already treats that as crossing midnight: attendance days run 08:00 to
 * 08:00 (a "shift day"), so a 22:00 start and the next morning's clock-out
 * belong to the same day, and late detection, early clock-out, the
 * auto-close-forgotten-session job and the absence check all work for it.
 */
export const FALLBACK_SHIFT_PRESETS: Array<Pick<ShiftTemplate, "name" | "shiftStart" | "shiftEnd">> = [
  { name: "09:00–18:00", shiftStart: "09:00", shiftEnd: "18:00" },
  { name: "09:30–18:30", shiftStart: "09:30", shiftEnd: "18:30" },
  { name: "10:00–19:00", shiftStart: "10:00", shiftEnd: "19:00" },
  { name: "11:00–20:00", shiftStart: "11:00", shiftEnd: "20:00" },
  { name: "Night 22:00–06:00", shiftStart: "22:00", shiftEnd: "06:00" },
];

/** People matching a search (name or email) and a department name; only active accounts. */
export function filterPeople(
  users: UserSummary[],
  { search, department }: { search: string; department: string },
  allDepartments = "__all__",
): UserSummary[] {
  const q = search.trim().toLowerCase();
  return users
    .filter((u) => u.isActive)
    .filter((u) => department === allDepartments || u.department?.name === department)
    .filter((u) => !q || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
}
