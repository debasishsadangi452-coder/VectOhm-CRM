import { apiFetch } from "./client";
import type {
  AttendanceCalendar,
  AttendancePolicy,
  AttendanceReport,
  AttendanceSettingsView,
  CompanyHoliday,
  DayStatus,
  DeptPolicyField,
  LiveBoard,
  MyAttendanceSummary,
  ShiftTemplate,
  WorkSession,
} from "./types";

export function listWorkSessions(userId?: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  return apiFetch<WorkSession[]>(`/work-sessions${qs ? `?${qs}` : ""}`);
}

export async function getActiveWorkSession() {
  // The endpoint returns null when there's no open session; Nest serializes
  // that as an empty body, which apiFetch surfaces as undefined. Coerce back to
  // null so React Query doesn't warn about an undefined query result.
  return (await apiFetch<WorkSession | null>("/work-sessions/active")) ?? null;
}

export function clockIn() {
  return apiFetch<WorkSession>("/work-sessions/clock-in", { method: "POST" });
}

export function clockOut(reason?: string) {
  return apiFetch<WorkSession>("/work-sessions/clock-out", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function startBreak() {
  return apiFetch<any>("/work-sessions/break/start", { method: "POST" });
}

export function endBreak() {
  return apiFetch<any>("/work-sessions/break/end", { method: "POST" });
}

export function submitLateReason(sessionId: string, reason: string) {
  return apiFetch<WorkSession>(`/work-sessions/${sessionId}/late-reason`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}


export function listDayStatuses(userId?: string, range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  return apiFetch<DayStatus[]>(`/work-sessions/day-statuses${qs ? `?${qs}` : ""}`);
}

export function getAttendanceCalendar(range?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  const qs = params.toString();
  return apiFetch<AttendanceCalendar>(`/work-sessions/calendar${qs ? `?${qs}` : ""}`);
}

export function listHolidays() {
  return apiFetch<CompanyHoliday[]>("/work-sessions/holidays");
}

export function createHoliday(input: { date: string; name: string }) {
  return apiFetch<CompanyHoliday>("/work-sessions/holidays", { method: "POST", body: JSON.stringify(input) });
}

export function deleteHoliday(id: string) {
  return apiFetch<{ success: boolean }>(`/work-sessions/holidays/${id}`, { method: "DELETE" });
}

/** An auto-closed session the user still has to correct, or null. */
export async function getPendingCorrection() {
  // Same empty-body-is-undefined coercion as getActiveWorkSession.
  return (await apiFetch<WorkSession | null>("/work-sessions/pending-correction")) ?? null;
}

export function submitCorrection(sessionId: string, input: { clockOutAt: string; note: string }) {
  return apiFetch<WorkSession>(`/work-sessions/${sessionId}/correct-clock-out`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAttendanceReport(opts: { from?: string; to?: string; userId?: string; departmentId?: string }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) if (v) params.set(k, v);
  const qs = params.toString();
  return apiFetch<AttendanceReport>(`/work-sessions/report${qs ? `?${qs}` : ""}`);
}

export function getMyAttendanceSummary() {
  return apiFetch<MyAttendanceSummary>("/work-sessions/my-summary");
}

export function getLiveBoard(departmentId?: string) {
  return apiFetch<LiveBoard>(`/work-sessions/live${departmentId ? `?departmentId=${departmentId}` : ""}`);
}

/** Accept (EXCUSED) or reject a late / early reason; PENDING clears an earlier decision. */
export function reviewReason(
  sessionId: string,
  input: { kind: "LATE" | "EARLY"; status: "EXCUSED" | "REJECTED" | "PENDING"; note?: string },
) {
  return apiFetch<WorkSession>(`/work-sessions/${sessionId}/review`, { method: "POST", body: JSON.stringify(input) });
}

// ─── rules + shift templates (Admin / HR) ────────────────────────────────────

export function getAttendanceSettings() {
  return apiFetch<AttendanceSettingsView>("/attendance-settings");
}

export function updateAttendanceSettings(patch: Partial<AttendancePolicy>) {
  return apiFetch<AttendanceSettingsView>("/attendance-settings", { method: "PUT", body: JSON.stringify(patch) });
}

export function setDepartmentPolicy(departmentId: string, patch: Partial<Record<DeptPolicyField, number | null>>) {
  return apiFetch<AttendanceSettingsView>(`/attendance-settings/departments/${departmentId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function clearDepartmentPolicy(departmentId: string) {
  return apiFetch<AttendanceSettingsView>(`/attendance-settings/departments/${departmentId}`, { method: "DELETE" });
}

export function listShiftTemplates() {
  return apiFetch<ShiftTemplate[]>("/attendance-settings/shift-templates");
}

export function createShiftTemplate(input: { name: string; shiftStart: string; shiftEnd: string }) {
  return apiFetch<ShiftTemplate>("/attendance-settings/shift-templates", { method: "POST", body: JSON.stringify(input) });
}

export function deleteShiftTemplate(id: string) {
  return apiFetch<{ success: boolean }>(`/attendance-settings/shift-templates/${id}`, { method: "DELETE" });
}

export function applyShiftTemplate(id: string, userIds: string[]) {
  return apiFetch<{ updated: number; shiftStart: string; shiftEnd: string }>(
    `/attendance-settings/shift-templates/${id}/apply`,
    { method: "POST", body: JSON.stringify({ userIds }) },
  );
}
