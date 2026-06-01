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

// Hardcoded coordinate/metadata fixes for source-DB bad rows (lat/lng=0 etc.).
// Keyed by festival id from /festivals.json.
const STATIC_FIXES: Record<string, Partial<Festival>> = {
  // 大潟かっぱ祭り (新潟県上越市) — 重複データで lat/lng=0
  "f-16347-245fe7": { prefecture: "新潟県", city: "上越市", lat: 37.2335695, lng: 138.3288482 },
  "f-16501-51dbf9": { prefecture: "新潟県", city: "上越市", lat: 37.2335695, lng: 138.3288482 },
  // 弘願寺 歯の健康祈願祭(関屋地蔵尊大祭) — 奈良県橿原市 弘願寺
  "f-24834-d3135c": { prefecture: "奈良県", city: "橿原市", lat: 34.5092, lng: 135.7806 },
};

export function applyOverrides(list: Festival[]): Festival[] {
  const m = read();
  const hasUserOv = Object.keys(m).length > 0;
  return list.map((f) => {
    const fix = STATIC_FIXES[f.id];
    let out = fix ? { ...f, ...fix } : f;
    if (hasUserOv) {
      const ov = m[f.id];
      if (ov) out = { ...out, startDate: ov.startDate, endDate: ov.endDate };
    }
    return out;
  });
}
