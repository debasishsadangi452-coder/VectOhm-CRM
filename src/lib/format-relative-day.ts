// "Today" / "Yesterday" for the last two calendar days, otherwise a short
// absolute date -- used everywhere task-update timestamps get grouped into
// day buckets (per-task Progress Updates, the Daily Updates tab, Dev's
// sprint feed) so the labeling is consistent across all three.
export function formatRelativeDay(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
