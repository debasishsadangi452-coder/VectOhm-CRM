// Shared "cold" threshold for the Follow-Up Reminders widget -- an
// unopened SENT bulk email or sequence step older than this is surfaced so
// nothing sent to a lead is silently forgotten. Shared by both
// bulk-email.service.ts and sequences.service.ts so the two channels can
// never quietly drift to different definitions of "cold".
export const FOLLOW_UP_COLD_DAYS = 3;

export function followUpColdSince(days: number = FOLLOW_UP_COLD_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
