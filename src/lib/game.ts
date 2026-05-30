import type { Festival } from "@/data/festivals";

export type PlayerState = {
  conqueredIds: string[];
  xp: number;
};

const STORAGE_KEY = "matsuri-quest-player-v1";

export function loadPlayer(): PlayerState {
  if (typeof window === "undefined") return { conqueredIds: [], xp: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conqueredIds: [], xp: 0 };
    return JSON.parse(raw) as PlayerState;
  } catch {
    return { conqueredIds: [], xp: 0 };
  }
}

export function savePlayer(state: PlayerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function levelFromXp(xp: number): { level: number; into: number; need: number; pct: number } {
  // Each level needs 1000 + level*250 xp (cumulative-ish, simple curve)
  let level = 1;
  let remaining = xp;
  let need = 1000;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = 1000 + (level - 1) * 250;
  }
  return { level, into: remaining, need, pct: Math.min(100, (remaining / need) * 100) };
}

export function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateIso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function festivalStatus(f: Festival): "upcoming" | "live" | "past" {
  const start = daysUntil(f.startDate);
  const end = daysUntil(f.endDate);
  if (end < 0) return "past";
  if (start <= 0 && end >= 0) return "live";
  return "upcoming";
}

export function sortByUrgency(list: Festival[]): Festival[] {
  return [...list].sort((a, b) => {
    const da = daysUntil(a.startDate);
    const db = daysUntil(b.startDate);
    const aFuture = da >= 0 ? da : 10000 - da;
    const bFuture = db >= 0 ? db : 10000 - db;
    return aFuture - bFuture;
  });
}
