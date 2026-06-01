import type { Festival } from "@/data/festivals";

export type LatLng = { lat: number; lng: number };

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function sortByDistance(list: Festival[], origin: LatLng): Festival[] {
  return [...list]
    .filter((f) => typeof f.lat === "number" && typeof f.lng === "number")
    .map((f) => ({ f, d: distanceKm(origin, { lat: f.lat, lng: f.lng }) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.f);
}

/** XP totals per prefecture (for heatmap coloring). */
export function xpByPrefecture(list: Festival[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of list) {
    if (!f.prefecture) continue;
    out[f.prefecture] = (out[f.prefecture] ?? 0) + (f.xp || 0);
  }
  return out;
}

/** Map a prefecture's XP to a heat color (0-1 normalized). */
export function heatColor(t: number): string {
  // cool (blue) → hot (orange/red), matching app's lantern palette
  const clamped = Math.max(0, Math.min(1, t));
  // oklch hue goes from 270 (blue) → 30 (orange)
  const hue = 270 - clamped * 240;
  const chroma = 0.12 + clamped * 0.12;
  const light = 0.5 + clamped * 0.15;
  return `oklch(${light.toFixed(2)} ${chroma.toFixed(2)} ${hue.toFixed(0)})`;
}
