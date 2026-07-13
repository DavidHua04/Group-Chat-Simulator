/**
 * Probabilistic memory decay (spec §8.2).
 *
 * Each memory's recall probability falls exponentially with age; memories the
 * character merely observed (didn't participate in) decay faster via a flat
 * multiplier. Whether a memory is recalled on a given day is decided by a
 * deterministic pseudo-random roll seeded by (memory id, date) so a memory
 * doesn't flicker in and out within the same day.
 */

export const HALF_LIFE_DAYS = 30;
export const OBSERVER_MULTIPLIER = 0.5;
export const PRUNE_THRESHOLD = 0.02;

export function recallProbability(ageDays: number, participated: boolean): number {
  const base = Math.exp((-Math.LN2 * Math.max(0, ageDays)) / HALF_LIFE_DAYS);
  return base * (participated ? 1 : OBSERVER_MULTIPLIER);
}

/** FNV-1a hash of a string, mapped to [0, 1). */
export function deterministicRoll(memoryId: string, dateKey: string): number {
  const input = `${memoryId}|${dateKey}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

export type RecallState = "recalled" | "not_recalled" | "forgotten";

export function recallState(
  memoryId: string,
  createdAt: string | Date,
  participated: boolean,
  nowDate: Date = new Date(),
): RecallState {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const ageDays = (nowDate.getTime() - created.getTime()) / 86_400_000;
  const p = recallProbability(ageDays, participated);
  if (p < PRUNE_THRESHOLD) return "forgotten";
  const dateKey = nowDate.toISOString().slice(0, 10);
  return deterministicRoll(memoryId, dateKey) < p ? "recalled" : "not_recalled";
}
