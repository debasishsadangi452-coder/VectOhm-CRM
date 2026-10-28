// How long screen recordings are kept before the retention sweep deletes them
// (see ScreenRecordingsService.sweepExpired). Shared with the monitoring notice
// (auth/terms.ts) so what employees are told always matches what happens.
// Overridable with SCREEN_RECORDING_RETENTION_DAYS.
export const SCREEN_RECORDING_RETENTION_DAYS = Number(process.env.SCREEN_RECORDING_RETENTION_DAYS ?? 90);
