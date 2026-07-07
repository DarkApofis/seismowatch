/**
 * Compact, English relative-time formatter, e.g. "23s ago", "5m ago", "2h ago".
 *
 * Pure (takes `now` explicitly) so it is deterministic and testable, and so the
 * caller controls the clock. Future timestamps clamp to "just now".
 */
export function formatRelativeTime(from: Date, now: Date): string {
  const deltaMs = now.getTime() - from.getTime();
  const seconds = Math.floor(deltaMs / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
