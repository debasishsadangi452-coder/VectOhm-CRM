const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  y: 365 * 86_400_000,
};

export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)(s|m|h|d|y)$/.exec(ttl.trim());
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}". Expected e.g. "15m", "7d", "10y".`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}
