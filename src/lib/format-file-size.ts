// Human-readable byte count, e.g. "148 MB" -- one decimal place only below
// 10 of a unit, so sizes stay short in tight table cells.
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value).toString();
  return `${rounded} ${units[unit]}`;
}
