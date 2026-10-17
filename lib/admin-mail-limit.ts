// Administrative SMTP actions are explicitly initiated, bounded, and local to
// tzbiz. This is a single-process guard, not a distributed anti-abuse service.
const entries = new Map<string, { count: number; resetAt: number }>();
export function adminMailAllowed(userId: string, action: string) {
  const now = Date.now();
  for (const [key, value] of entries)
    if (value.resetAt <= now) entries.delete(key);
  const key = `${userId}:${action}`;
  const current = entries.get(key);
  if (current && current.count >= 3) return false;
  entries.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? now + 10 * 60 * 1000,
  });
  return true;
}
