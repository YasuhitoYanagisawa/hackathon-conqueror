import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MatsuriAIChat } from "@/components/MatsuriAIChat";
import {
  CATEGORIES,
  type CategoryFilter,
  type Festival,
} from "@/data/festivals";
import { useFestivals } from "@/hooks/use-festivals";
import { useGeo } from "@/hooks/use-geo";
import { distanceKm, sortByDistance } from "@/lib/geo";
import { applyOverrides, getOverride, setOverride } from "@/lib/overrides";
import { refreshFestivalDate } from "@/lib/api/refresh.functions";
import {
  daysUntil,
  festivalStatus,
  levelFromXp,
  loadPlayer,
  savePlayer,
  sortByUrgency,
} from "@/lib/game";

const PAGE_SIZE = 60;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Matsuri Quest — 日本のお祭り攻略マップ" },
      {
        name: "description",
        content:
          "全国29,000以上のお祭り・伝統行事を“クエスト”として攻略するゲーミフィケーション・イベント管理アプリ。",
      },
      { property: "og:title", content: "Matsuri Quest — 日本のお祭り攻略マップ" },
      {
        property: "og:description",
        content:
          "次の祭りまであと何日？ レベルを上げて、四季と土地の物語を巡る旅へ。",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: rawFestivals, isLoading, error } = useFestivals();
  const [player, setPlayer] = useState(() => loadPlayer());
  const [filter, setFilter] = useState<CategoryFilter>("すべて");
  const [query, setQuery] = useState("");
  const [pref, setPref] = useState<string>("すべて");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<Festival | null>(null);
  const [sortMode, setSortMode] = useState<"urgency" | "nearby">("urgency");
  // Bump to force re-render after overrides change (Gemini refresh).
  const [overrideTick, setOverrideTick] = useState(0);
  const geo = useGeo();

  const FESTIVALS = useMemo(
    () => (rawFestivals ? applyOverrides(rawFestivals) : undefined),
    // overrideTick intentionally triggers re-apply
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFestivals, overrideTick],
  );

  useEffect(() => savePlayer(player), [player]);
  useEffect(() => setPage(1), [filter, query, pref, sortMode]);

  const conquered = useMemo(
    () => new Set(player.conqueredIds),
    [player.conqueredIds],
  );

  const prefectures = useMemo(() => {
    if (!FESTIVALS) return ["すべて"];
    const s = new Set<string>();
    FESTIVALS.forEach((f) => f.prefecture && s.add(f.prefecture));
    return ["すべて", ...Array.from(s).sort()];
  }, [FESTIVALS]);

  const filtered = useMemo(() => {
    if (!FESTIVALS) return [] as Festival[];
    const q = query.trim().toLowerCase();
    const list = FESTIVALS.filter((f) => {
      if (filter !== "すべて" && f.category !== filter) return false;
      if (pref !== "すべて" && f.prefecture !== pref) return false;
      if (
        q &&
        !`${f.name} ${f.prefecture} ${f.city} ${f.description}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    if (sortMode === "nearby" && geo.pos) return sortByDistance(list, geo.pos);
    return sortByUrgency(list);
  }, [FESTIVALS, filter, pref, query, sortMode, geo.pos]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const lvl = levelFromXp(player.xp);
  const total = FESTIVALS?.length ?? 0;
  const prefStats = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    if (!FESTIVALS) return m;
    for (const f of FESTIVALS) {
      if (!f.prefecture) continue;
      const s = m.get(f.prefecture) ?? { total: 0, done: 0 };
      s.total += 1;
      if (conquered.has(f.id)) s.done += 1;
      m.set(f.prefecture, s);
    }
    return m;
  }, [FESTIVALS, conquered]);
  const overallCoverage = total ? Math.round((conquered.size / total) * 10000) / 100 : 0;
  const upcoming30 = useMemo(() => {
    if (!FESTIVALS) return 0;
    return FESTIVALS.filter((f) => {
      const d = daysUntil(f.startDate);
      return d >= 0 && d <= 30;
    }).length;
  }, [FESTIVALS]);

  const nextQuest = useMemo(() => {
    if (!FESTIVALS) return undefined;
    return sortByUrgency(
      FESTIVALS.filter((f) => daysUntil(f.endDate) >= 0 && f.rank === "S"),
    )[0];
  }, [FESTIVALS]);

  function toggleConquer(f: Festival) {
    setPlayer((p) => {
      const has = p.conqueredIds.includes(f.id);
      return has
        ? { conqueredIds: p.conqueredIds.filter((id) => id !== f.id), xp: Math.max(0, p.xp - f.xp) }
        : { conqueredIds: [...p.conqueredIds, f.id], xp: p.xp + f.xp };
    });
  }

  return (
    <div className="min-h-screen washi-texture relative overflow-hidden">
      <FloatingEmbers />

      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        <Header total={total} />

        <PlayerHud
          level={lvl.level}
          into={lvl.into}
          need={lvl.need}
          pct={lvl.pct}
          xp={player.xp}
          conqueredPrefs={conqueredPrefs.size}
          prefTotal={PREF_TOTAL}
          completion={prefCompletion}
          upcoming30={upcoming30}
        />


        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            29,000件のお祭りDBを読み込み中…
          </div>
        )}
        {error && (
          <div className="text-center py-12 text-destructive">
            DB読み込みに失敗しました
          </div>
        )}

        {!isLoading && !error && FESTIVALS && (
          <>
            {nextQuest && (
              <NextQuest
                festival={nextQuest}
                conquered={conquered}
                onConquer={toggleConquer}
                onOpen={setActive}
              />
            )}

            <GeoToolbar
              geo={geo}
              sortMode={sortMode}
              onSortMode={setSortMode}
            />

            <SearchBar
              query={query}
              onQuery={setQuery}
              pref={pref}
              onPref={setPref}
              prefs={prefectures}
              count={filtered.length}
            />

            <CategoryFilters value={filter} onChange={setFilter} />

            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-6">
              {visible.map((f) => (
                <FestivalCard
                  key={f.id}
                  festival={f}
                  conquered={conquered.has(f.id)}
                  distanceKm={geo.pos ? distanceKm(geo.pos, { lat: f.lat, lng: f.lng }) : undefined}
                  onOpen={() => setActive(f)}
                  onConquer={() => toggleConquer(f)}
                />
              ))}
            </section>

            {visible.length < filtered.length && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-6 py-3 rounded-full text-sm font-bold"
                  style={{
                    background: "var(--gradient-lantern)",
                    color: "white",
                    boxShadow: "0 0 20px -6px var(--color-lantern-glow)",
                  }}
                >
                  さらに表示（残り {(filtered.length - visible.length).toLocaleString()} 件）
                </button>
              </div>
            )}

            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                該当するお祭りが見つかりません
              </p>
            )}
          </>
        )}

        <Footer />
      </main>

      {active && (
        <FestivalSheet
          festival={active}
          conquered={conquered.has(active.id)}
          onConquer={() => toggleConquer(active)}
          onClose={() => setActive(null)}
          onRefreshed={() => setOverrideTick((t) => t + 1)}
        />
      )}

      <MatsuriAIChat />
    </div>
  );
}

/* ────────── components ────────── */

function GeoToolbar({
  geo,
  sortMode,
  onSortMode,
}: {
  geo: ReturnType<typeof useGeo>;
  sortMode: "urgency" | "nearby";
  onSortMode: (m: "urgency" | "nearby") => void;
}) {
  return (
    <div className="flex items-center flex-wrap gap-2 mb-4 p-3 rounded-xl border border-border bg-card/50">
      {!geo.pos ? (
        <button
          onClick={geo.request}
          disabled={geo.loading}
          className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ background: "var(--gradient-lantern)" }}
        >
          {geo.loading ? "📍 取得中…" : "📍 現在地から探す"}
        </button>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">
            📍 {geo.pos.lat.toFixed(2)}, {geo.pos.lng.toFixed(2)}
          </span>
          <button
            onClick={() => onSortMode("urgency")}
            className="px-3 py-1.5 rounded-md text-xs font-bold"
            style={{
              background: sortMode === "urgency" ? "var(--gradient-lantern)" : "var(--color-secondary)",
              color: sortMode === "urgency" ? "white" : "var(--color-muted-foreground)",
            }}
          >
            日付順
          </button>
          <button
            onClick={() => onSortMode("nearby")}
            className="px-3 py-1.5 rounded-md text-xs font-bold"
            style={{
              background: sortMode === "nearby" ? "var(--gradient-lantern)" : "var(--color-secondary)",
              color: sortMode === "nearby" ? "white" : "var(--color-muted-foreground)",
            }}
          >
            近い順
          </button>
          <button
            onClick={geo.clear}
            className="px-2 py-1.5 rounded-md text-xs bg-muted text-muted-foreground"
          >
            位置クリア
          </button>
        </>
      )}
      {geo.error && (
        <span className="text-xs text-destructive">{geo.error}</span>
      )}
      <span className="ml-auto text-[11px] text-muted-foreground">
        powered by Geolocation API
      </span>
    </div>
  );
}

function SearchBar({
  query,
  onQuery,
  pref,
  onPref,
  prefs,
  count,
}: {
  query: string;
  onQuery: (v: string) => void;
  pref: string;
  onPref: (v: string) => void;
  prefs: string[];
  count: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="祭名・地域・キーワードで検索…"
        className="flex-1 px-4 py-3 rounded-xl text-sm bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <select
        value={pref}
        onChange={(e) => onPref(e.target.value)}
        className="px-4 py-3 rounded-xl text-sm bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {prefs.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <div className="px-4 py-3 rounded-xl text-sm bg-muted text-muted-foreground whitespace-nowrap">
        {count.toLocaleString()} 件
      </div>
    </div>
  );
}

function Header({ total }: { total: number }) {
  return (
    <header className="flex items-center justify-between mb-10">
      <div className="flex items-center gap-3">
        <div className="lantern-bob relative">
          <div
            className="absolute inset-0 blur-2xl glow-pulse"
            style={{ background: "var(--gradient-lantern)", borderRadius: "9999px" }}
          />
          <div
            className="relative w-12 h-14 rounded-full grid place-items-center text-2xl"
            style={{
              background: "var(--gradient-lantern)",
              boxShadow: "var(--shadow-lantern)",
              border: "1px solid oklch(0.4 0.1 30)",
            }}
            aria-hidden
          >
            <span className="text-white font-bold" style={{ fontFamily: "var(--font-display)" }}>
              祭
            </span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-none">
            Matsuri <span style={{ color: "var(--color-gold)" }}>Quest</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-widest">
            日本のお祭り攻略マップ
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/map"
          className="px-3 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: "var(--gradient-lantern)" }}
        >
          🗺 マップ
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary glow-pulse" />
          全 {total.toLocaleString()} クエスト稼働中
        </div>
      </div>
    </header>
  );
}

function PlayerHud(props: {
  level: number;
  into: number;
  need: number;
  pct: number;
  xp: number;
  conqueredPrefs: number;
  prefTotal: number;
  completion: number;
  upcoming30: number;
}) {
  return (
    <section
      className="relative rounded-2xl p-6 sm:p-8 mb-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.18 0.05 275) 0%, oklch(0.14 0.04 270) 100%)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-40"
        style={{ background: "var(--gradient-lantern)" }}
        aria-hidden
      />
      <div className="relative grid sm:grid-cols-4 gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Level</p>
          <p className="text-5xl font-black mt-1" style={{ color: "var(--color-gold)" }}>
            {props.level}
          </p>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${props.pct}%`,
                background: "var(--gradient-lantern)",
                boxShadow: "0 0 12px var(--color-lantern-glow)",
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
            {props.into} / {props.need} XP
          </p>
        </div>

        <HudStat label="総XP" value={props.xp.toLocaleString()} suffix="pt" />
        <HudStat
          label="都道府県制覇"
          value={`${props.conqueredPrefs}`}
          suffix={`/ ${props.prefTotal} 県`}
          accent={`${props.completion}%`}
        />
        <HudStat label="30日以内に開催" value={`${props.upcoming30}`} suffix="件" pulse />
      </div>
    </section>
  );
}


function HudStat({
  label,
  value,
  suffix,
  accent,
  pulse,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        {label}
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-primary glow-pulse" />}
      </p>
      <p className="text-4xl font-black mt-1 tabular-nums">
        {value}
        {suffix && <span className="text-sm font-medium text-muted-foreground ml-1.5">{suffix}</span>}
      </p>
      {accent && (
        <p className="text-xs mt-2" style={{ color: "var(--color-gold)" }}>
          達成率 {accent}
        </p>
      )}
    </div>
  );
}

function NextQuest({
  festival,
  conquered,
  onConquer,
  onOpen,
}: {
  festival?: Festival;
  conquered: Set<string>;
  onConquer: (f: Festival) => void;
  onOpen: (f: Festival) => void;
}) {
  if (!festival) return null;
  const d = daysUntil(festival.startDate);
  const status = festivalStatus(festival);
  const isConq = conquered.has(festival.id);

  return (
    <section
      className="relative rounded-2xl p-6 sm:p-8 mb-10 overflow-hidden cursor-pointer group"
      style={{
        background: "var(--gradient-lantern)",
        boxShadow: "var(--shadow-lantern), var(--shadow-card)",
      }}
      onClick={() => onOpen(festival)}
    >
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay washi-texture"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-5">
          <div className="text-6xl sm:text-7xl drop-shadow-lg">{festival.emoji}</div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/80 mb-1">
              ◆ Next Quest ◆
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">{festival.name}</h2>
            <p className="text-sm text-white/85 mt-1">
              {festival.prefecture} {festival.city} ・ Rank {festival.rank} ・ +{festival.xp} XP
            </p>
          </div>
        </div>
        <div className="text-right">
          {status === "live" ? (
            <p className="text-3xl font-black text-white">開催中 🔥</p>
          ) : status === "past" ? (
            <p className="text-2xl font-bold text-white/70">終了</p>
          ) : (
            <>
              <p className="text-5xl sm:text-6xl font-black text-white tabular-nums leading-none">
                {d}
              </p>
              <p className="text-xs uppercase tracking-widest text-white/80 mt-1">日後に開催</p>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConquer(festival);
            }}
            className="mt-3 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isConq ? "oklch(1 0 0 / 0.9)" : "oklch(0 0 0 / 0.4)",
              color: isConq ? "var(--color-ink)" : "white",
              border: "1px solid oklch(1 0 0 / 0.3)",
            }}
          >
            {isConq ? "✓ 制覇済み" : "制覇マーク"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CategoryFilters({
  value,
  onChange,
}: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {CATEGORIES.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="px-4 py-2 rounded-full text-sm font-bold transition-all"
            style={{
              background: active ? "var(--gradient-lantern)" : "var(--color-secondary)",
              color: active ? "white" : "var(--color-muted-foreground)",
              boxShadow: active ? "0 0 20px -4px var(--color-lantern-glow)" : "none",
              border: "1px solid var(--color-border)",
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function FestivalCard({
  festival,
  conquered,
  distanceKm,
  onOpen,
  onConquer,
}: {
  festival: Festival;
  conquered: boolean;
  distanceKm?: number;
  onOpen: () => void;
  onConquer: () => void;
}) {
  const d = daysUntil(festival.startDate);
  const status = festivalStatus(festival);
  const rankColor =
    festival.rank === "S"
      ? "var(--color-rank-s)"
      : festival.rank === "A"
        ? "var(--color-rank-a)"
        : festival.rank === "B"
          ? "var(--color-rank-b)"
          : "var(--color-rank-c)";

  return (
    <article
      onClick={onOpen}
      className="relative rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 group"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {conquered && (
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-black tracking-widest"
          style={{ background: "var(--color-gold)", color: "var(--color-ink)" }}
        >
          ✓ CLEAR
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="text-4xl">{festival.emoji}</div>
        <div
          className="w-9 h-9 rounded-md grid place-items-center font-black text-sm"
          style={{
            background: `color-mix(in oklab, ${rankColor} 20%, transparent)`,
            color: rankColor,
            border: `1px solid ${rankColor}`,
          }}
        >
          {festival.rank}
        </div>
      </div>

      <h3 className="text-lg font-black leading-tight">{festival.name}</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {festival.prefecture} {festival.city}
        {typeof distanceKm === "number" && (
          <span className="ml-2 font-bold" style={{ color: "var(--color-gold)" }}>
            · {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km
          </span>
        )}
      </p>

      <div className="flex items-center gap-3 mt-4 text-xs">
        <span
          className="px-2 py-1 rounded-md font-medium"
          style={{
            background: "var(--color-muted)",
            color: "var(--color-muted-foreground)",
          }}
        >
          {festival.category}
        </span>
        <DifficultyDots level={festival.difficulty} />
      </div>

      <div className="flex items-end justify-between mt-4 pt-4 border-t border-border">
        <div>
          {status === "live" ? (
            <p className="text-sm font-bold" style={{ color: "var(--color-lantern-glow)" }}>
              🔥 開催中
            </p>
          ) : status === "past" ? (
            <p className="text-sm text-muted-foreground">終了</p>
          ) : (
            <>
              <p className="text-2xl font-black tabular-nums leading-none">
                {d}
                <span className="text-xs text-muted-foreground ml-1">日後</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{festival.startDate}〜</p>
            </>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConquer();
          }}
          className="text-xs font-bold px-3 py-1.5 rounded-md transition-all"
          style={{
            background: conquered ? "var(--color-muted)" : "var(--gradient-lantern)",
            color: conquered ? "var(--color-muted-foreground)" : "white",
          }}
        >
          {conquered ? "解除" : `+${festival.xp} XP`}
        </button>
      </div>
    </article>
  );
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`難易度 ${level}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background:
              i < level ? "var(--color-lantern)" : "var(--color-muted)",
          }}
        />
      ))}
    </span>
  );
}

function FestivalSheet({
  festival,
  conquered,
  onConquer,
  onClose,
  onRefreshed,
}: {
  festival: Festival;
  conquered: boolean;
  onConquer: () => void;
  onClose: () => void;
  onRefreshed: () => void;
}) {
  const d = daysUntil(festival.startDate);
  const refreshFn = useServerFn(refreshFestivalDate);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const existingOverride = getOverride(festival.id);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg("Geminiが公式情報を検索中…");
    try {
      const res = await refreshFn({
        data: {
          id: festival.id,
          name: festival.name,
          prefecture: festival.prefecture,
          city: festival.city,
          schedule: festival.schedule,
        },
      });
      if (res.ok) {
        setOverride(festival.id, {
          startDate: res.startDate,
          endDate: res.endDate,
          source: res.source,
          refreshedAt: new Date().toISOString(),
        });
        setRefreshMsg(`✓ 更新: ${res.startDate}〜${res.endDate}${res.confidence ? ` (${res.confidence})` : ""}`);
        onRefreshed();
      } else {
        setRefreshMsg(`✗ ${res.error ?? "失敗"}`);
      }
    } catch {
      setRefreshMsg("✗ 通信エラー");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-7 sm:p-9 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card), var(--shadow-lantern)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="閉じる"
        >
          ✕
        </button>

        <div className="text-6xl mb-4">{festival.emoji}</div>
        <h3 className="text-2xl font-black">{festival.name}</h3>
        <p className="text-sm text-muted-foreground">{festival.nameEn}</p>

        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <Stat label="開催地" value={festival.prefecture} />
          <Stat label="Rank" value={festival.rank} accent />
          <Stat label="XP" value={`+${festival.xp}`} />
        </div>

        <p className="text-sm leading-relaxed mt-5 text-muted-foreground">
          {festival.description}
        </p>

        <div
          className="rounded-lg p-4 mt-5 text-center"
          style={{ background: "var(--color-muted)" }}
        >
          {d >= 0 ? (
            <>
              <p className="text-4xl font-black tabular-nums" style={{ color: "var(--color-gold)" }}>
                {d}<span className="text-base text-muted-foreground ml-1">日後</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {festival.startDate} 〜 {festival.endDate}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">過去のお祭り</p>
          )}
          {existingOverride && (
            <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
              🔄 Gemini更新済 ({new Date(existingOverride.refreshedAt).toLocaleDateString("ja-JP")})
            </p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold border disabled:opacity-50"
          style={{
            borderColor: "var(--color-border)",
            background: "transparent",
            color: "var(--color-foreground)",
          }}
        >
          {refreshing ? "検索中…" : "🔍 Geminiで最新日程を取得（Grounding）"}
        </button>
        {refreshMsg && (
          <p className="text-[11px] text-center mt-2 text-muted-foreground">
            {refreshMsg}
          </p>
        )}

        <button
          onClick={onConquer}
          className="w-full mt-4 py-3 rounded-lg font-black tracking-widest text-sm"
          style={{
            background: conquered ? "var(--color-muted)" : "var(--gradient-lantern)",
            color: conquered ? "var(--color-muted-foreground)" : "white",
            boxShadow: conquered ? "none" : "0 0 24px -6px var(--color-lantern-glow)",
          }}
        >
          {conquered ? "✓ 制覇済み（タップで解除）" : `この祭りを制覇する → +${festival.xp} XP`}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--color-muted)" }}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className="text-base font-black mt-1"
        style={{ color: accent ? "var(--color-gold)" : "var(--color-foreground)" }}
      >
        {value}
      </p>
    </div>
  );
}

function FloatingEmbers() {
  // Decorative drifting embers
  const embers = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {embers.map((_, i) => {
        const left = (i * 73) % 100;
        const delay = (i * 1.3) % 8;
        const dur = 8 + ((i * 2) % 10);
        const size = 3 + (i % 4);
        return (
          <span
            key={i}
            className="absolute bottom-0 rounded-full"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: "var(--color-lantern-glow)",
              boxShadow: "0 0 12px var(--color-lantern-glow)",
              animation: `ember-rise ${dur}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
      <p>Matsuri Quest — お祭りで日本を旅するゲーミフィケーション・イベント管理</p>
      <p className="mt-1 opacity-60">Microsoft Agent Hackathon 2026 entry · powered by お祭りDB</p>
    </footer>
  );
}
