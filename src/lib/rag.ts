import type { Festival } from "@/data/festivals";
import { daysUntil } from "@/lib/game";

// Very lightweight keyword tokenizer for Japanese + ASCII.
function tokenize(q: string): string[] {
  const cleaned = q
    .replace(/[、。！？!?\.,「」『』（）()\[\]【】\s]+/g, " ")
    .trim();
  if (!cleaned) return [];
  const tokens = new Set<string>();
  for (const w of cleaned.split(/\s+/)) {
    if (w.length >= 2) tokens.add(w);
    // also add 2-gram sliding windows for kanji/kana strings
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(w)) {
      for (let i = 0; i + 2 <= w.length; i++) tokens.add(w.slice(i, i + 2));
    }
  }
  return Array.from(tokens);
}

function score(f: Festival, tokens: string[]): number {
  if (!tokens.length) return 0;
  const hayName = `${f.name} ${f.nameEn ?? ""}`.toLowerCase();
  const hayPlace = `${f.prefecture} ${f.city} ${f.venue ?? ""} ${f.station ?? ""}`.toLowerCase();
  const hayBody = `${f.description ?? ""} ${(f.tags ?? []).join(" ")} ${f.category}`.toLowerCase();
  let s = 0;
  for (const t of tokens) {
    const lo = t.toLowerCase();
    if (hayPlace.includes(lo)) s += 5;
    if (hayName.includes(lo)) s += 4;
    if (hayBody.includes(lo)) s += 1;
  }
  return s;
}

export function buildRagContext(
  query: string,
  all: Festival[],
  opts: { limit?: number; upcomingOnly?: boolean } = {},
): string {
  const tokens = tokenize(query);
  const upcomingOnly = opts.upcomingOnly ?? /これから|今後|直近|来月|今月|来週|今週|next|upcoming/i.test(query);
  const limit = opts.limit ?? 25;

  const pool = upcomingOnly
    ? all.filter((f) => daysUntil(f.endDate) >= 0)
    : all;

  const ranked = pool
    .map((f) => ({ f, s: score(f, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return daysUntil(a.f.startDate) - daysUntil(b.f.startDate);
    })
    .slice(0, limit)
    .map((x) => x.f);

  // Fallback: if nothing matched, take the next N upcoming nationwide.
  const picks =
    ranked.length > 0
      ? ranked
      : pool
          .slice()
          .sort((a, b) => daysUntil(a.startDate) - daysUntil(b.startDate))
          .slice(0, Math.min(15, limit));

  if (!picks.length) return "(関連データなし)";

  return picks
    .map((f, i) => {
      const d = daysUntil(f.startDate);
      const when = `${f.startDate}〜${f.endDate}` + (d >= 0 ? ` (あと${d}日)` : ` (終了)`);
      return `${i + 1}. ${f.name} / ${f.prefecture}${f.city} / ${f.category} / ${when}${
        f.venue ? ` / 会場:${f.venue}` : ""
      }${f.url ? ` / ${f.url}` : ""}`;
    })
    .join("\n");
}
