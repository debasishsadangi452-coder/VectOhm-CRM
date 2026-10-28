import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listWorkSessions,
  getActiveWorkSession,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  submitLateReason,
  listDayStatuses,
  getAttendanceCalendar,
  createHoliday,
  deleteHoliday,
  getPendingCorrection,
  submitCorrection,
  getAttendanceReport,
  getMyAttendanceSummary,
  getLiveBoard,
  reviewReason,
  getAttendanceSettings,
  updateAttendanceSettings,
  setDepartmentPolicy,
  clearDepartmentPolicy,
  listShiftTemplates,
  createShiftTemplate,
  deleteShiftTemplate,
  applyShiftTemplate,
} from "@/lib/api/work-sessions";
import type { AttendancePolicy, DeptPolicyField } from "@/lib/api/types";

import { useAuthStore } from "@/stores/auth-store";

export const WORK_SESSIONS_KEY = ["work-sessions"] as const;
export const ACTIVE_SESSION_KEY = ["work-sessions", "active"] as const;

export function useWorkSessions(
  userId?: string,
  range?: { from?: string; to?: string },
  refetchInterval: number | false = false,
) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: [...WORK_SESSIONS_KEY, userId, range?.from, range?.to],
    queryFn: () => listWorkSessions(userId, range),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? refetchInterval : false,
  });
}

export function useActiveWorkSession() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: getActiveWorkSession,
    enabled: isAuthenticated,
    // Polling every 15s to keep clock and break timers current
    refetchInterval: isAuthenticated ? 15000 : false,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clockIn,
    onSuccess: (session) => {
      qc.setQueryData(ACTIVE_SESSION_KEY, session);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => clockOut(reason),
    onSuccess: () => {
      qc.setQueryData(ACTIVE_SESSION_KEY, null);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useStartBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startBreak,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useEndBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endBreak,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useSubmitLateReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason: string }) =>
      submitLateReason(sessionId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY });
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export const DAY_STATUSES_KEY = ["work-sessions", "day-statuses"] as const;
export const ATTENDANCE_CALENDAR_KEY = ["work-sessions", "calendar"] as const;
export const PENDING_CORRECTION_KEY = ["work-sessions", "pending-correction"] as const;

/** Days with no session: "Absent" and "On leave", for the same range as the sessions list. */
export function useDayStatuses(userId?: string, range?: { from?: string; to?: string }) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: [...DAY_STATUSES_KEY, userId, range?.from, range?.to],
    queryFn: () => listDayStatuses(userId, range),
    enabled: isAuthenticated,
  });
}

/** Weekly days off plus company holidays in a range. */
export function useAttendanceCalendar(range?: { from?: string; to?: string }) {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: [...ATTENDANCE_CALENDAR_KEY, range?.from, range?.to],
    queryFn: () => getAttendanceCalendar(range),
    enabled: isAuthenticated,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHoliday,
    onSuccess: () => qc.invalidateQueries({ queryKey: ATTENDANCE_CALENDAR_KEY }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => qc.invalidateQueries({ queryKey: ATTENDANCE_CALENDAR_KEY }),
  });
}

/** The auto-closed session (if any) the signed-in user still has to correct. */
export function usePendingCorrection() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
  return useQuery({
    queryKey: PENDING_CORRECTION_KEY,
    queryFn: getPendingCorrection,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function useSubmitCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, clockOutAt, note }: { sessionId: string; clockOutAt: string; note: string }) =>
      submitCorrection(sessionId, { clockOutAt, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENDING_CORRECTION_KEY });
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export const ATTENDANCE_REPORT_KEY = ["work-sessions", "report"] as const;
export const MY_SUMMARY_KEY = ["work-sessions", "my-summary"] as const;
export const LIVE_BOARD_KEY = ["work-sessions", "live"] as const;
export const ATTENDANCE_SETTINGS_KEY = ["attendance-settings"] as const;
export const SHIFT_TEMPLATES_KEY = ["attendance-settings", "shift-templates"] as const;

function useAuthed() {
  return useAuthStore((s) => s.status === "authenticated" && !!s.accessToken);
}

/** Per-employee attendance numbers for a range (a month, normally). */
export function useAttendanceReport(opts: { from?: string; to?: string; userId?: string; departmentId?: string }, enabled = true) {
  const authed = useAuthed();
  return useQuery({
    queryKey: [...ATTENDANCE_REPORT_KEY, opts.from, opts.to, opts.userId, opts.departmentId],
    queryFn: () => getAttendanceReport(opts),
    enabled: authed && enabled,
  });
}

/** The signed-in user's own month, streaks and recent days. */
export function useMyAttendanceSummary() {
  const authed = useAuthed();
  return useQuery({ queryKey: MY_SUMMARY_KEY, queryFn: getMyAttendanceSummary, enabled: authed, staleTime: 60_000 });
}

/** Who is working / on a break / idle / not in right now. Refreshes every 30 seconds. */
export function useLiveBoard(departmentId?: string, enabled = true) {
  const authed = useAuthed();
  return useQuery({
    queryKey: [...LIVE_BOARD_KEY, departmentId],
    queryFn: () => getLiveBoard(departmentId),
    enabled: authed && enabled,
    refetchInterval: authed && enabled ? 30_000 : false,
  });
}

export function useReviewReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      ...input
    }: {
      sessionId: string;
      kind: "LATE" | "EARLY";
      status: "EXCUSED" | "REJECTED" | "PENDING";
      note?: string;
    }) => reviewReason(sessionId, input),
    // A decision changes the counts everywhere -- sessions, the report, streaks.
    onSuccess: () => qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY }),
  });
}

export function useAttendanceSettings(enabled = true) {
  const authed = useAuthed();
  return useQuery({ queryKey: ATTENDANCE_SETTINGS_KEY, queryFn: getAttendanceSettings, enabled: authed && enabled });
}

export function useUpdateAttendanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AttendancePolicy>) => updateAttendanceSettings(patch),
    onSuccess: (view) => {
      qc.setQueryData(ATTENDANCE_SETTINGS_KEY, view);
      // Weekly days off, hours rules etc. feed the calendar and the report.
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useSetDepartmentPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ departmentId, patch }: { departmentId: string; patch: Partial<Record<DeptPolicyField, number | null>> }) =>
      setDepartmentPolicy(departmentId, patch),
    onSuccess: (view) => {
      qc.setQueryData(ATTENDANCE_SETTINGS_KEY, view);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useClearDepartmentPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (departmentId: string) => clearDepartmentPolicy(departmentId),
    onSuccess: (view) => {
      qc.setQueryData(ATTENDANCE_SETTINGS_KEY, view);
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}

export function useShiftTemplates(enabled = true) {
  const authed = useAuthed();
  return useQuery({ queryKey: SHIFT_TEMPLATES_KEY, queryFn: listShiftTemplates, enabled: authed && enabled });
}

export function useCreateShiftTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShiftTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIFT_TEMPLATES_KEY }),
  });
}

export function useDeleteShiftTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteShiftTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIFT_TEMPLATES_KEY }),
  });
}

export function useApplyShiftTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) => applyShiftTemplate(id, userIds),
    // Hours changed for these people: refresh the user lists / sessions that show shifts.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: WORK_SESSIONS_KEY });
    },
  });
}
