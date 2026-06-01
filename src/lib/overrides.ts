// LocalStorage overrides for festival dates (refreshed via Gemini grounding).
import type { Festival } from "@/data/festivals";

const KEY = "matsuri-quest-date-overrides-v1";

export type DateOverride = {
  startDate: string;
  endDate: string;
  source?: string;
  refreshedAt: string;
};

type Map = Record<string, DateOverride>;

function read(): Map {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(map: Map) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function getOverride(id: string): DateOverride | undefined {
  return read()[id];
}

export function setOverride(id: string, ov: DateOverride) {
  const m = read();
  m[id] = ov;
  write(m);
}

export function applyOverrides(list: Festival[]): Festival[] {
  const m = read();
  if (Object.keys(m).length === 0) return list;
  return list.map((f) => {
    const ov = m[f.id];
    return ov ? { ...f, startDate: ov.startDate, endDate: ov.endDate } : f;
  });
}
