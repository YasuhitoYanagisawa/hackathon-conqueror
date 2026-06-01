import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useFestivals } from "@/hooks/use-festivals";
import { useGeo } from "@/hooks/use-geo";
import { sortByDistance, distanceKm, daysUntil } from "@/lib/geo";
import { applyOverrides } from "@/lib/overrides";
import type { Festival } from "@/data/festivals";

const FestivalMap = lazy(() =>
  import("@/components/FestivalMap").then((m) => ({ default: m.FestivalMap })),
);

const WINDOW_DAYS = 30;

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "祭マップ — Matsuri Quest" },
      { name: "description", content: "全国のお祭りを地図で探索。都道府県ごとの年間お祭り数ヒートマップと、直近1か月の開催情報。" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data, isLoading } = useFestivals();
  const geo = useGeo();
  const [selected, setSelected] = useState<Festival | null>(null);

  const festivals = useMemo(() => (data ? applyOverrides(data) : []), [data]);

  const upcoming = useMemo(
    () =>
      festivals.filter((f) => {
        const d = daysUntil(f.startDate);
        return d >= -1 && d <= WINDOW_DAYS;
      }),
    [festivals],
  );

  const nearby = useMemo(() => {
    if (!geo.pos || !upcoming.length) return [];
    return sortByDistance(upcoming, geo.pos).slice(0, 15);
  }, [geo.pos, upcoming]);

  return (
    <div className="min-h-screen washi-texture">
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← トップへ戻る
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">
              祭マップ <span style={{ color: "var(--color-gold)" }}>{upcoming.length.toLocaleString()}</span> 件
              <span className="text-sm font-normal text-muted-foreground ml-2">/ 直近{WINDOW_DAYS}日</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              色の濃淡＝都道府県の年間お祭り数 (全{festivals.length.toLocaleString()}件ベース) / マーカー＝今後{WINDOW_DAYS}日以内の開催
            </p>
          </div>

          <div className="flex gap-2 items-center">
            {geo.pos ? (
              <>
                <span className="text-xs text-muted-foreground">
                  📍 {geo.pos.lat.toFixed(3)}, {geo.pos.lng.toFixed(3)}
                </span>
                <button
                  onClick={geo.clear}
                  className="px-3 py-2 rounded-lg text-xs bg-muted text-muted-foreground"
                >
                  位置をクリア
                </button>
              </>
            ) : (
              <button
                onClick={geo.request}
                disabled={geo.loading}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "var(--gradient-lantern)" }}
              >
                {geo.loading ? "取得中…" : "📍 現在地を取得"}
              </button>
            )}
          </div>
        </div>

        {geo.error && (
          <p className="text-xs text-destructive mb-3">{geo.error}</p>
        )}

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">DB読み込み中…</div>
        ) : (
          <Suspense fallback={<div className="text-center py-20">地図を準備中…</div>}>
            <FestivalMap
              festivals={festivals}
              upcoming={upcoming}
              userPos={geo.pos}
              onSelect={setSelected}
            />
          </Suspense>
        )}


        {geo.pos && nearby.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-black mb-3">📍 近隣の祭り Top 15</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {nearby.map((f) => {
                const d = distanceKm(geo.pos!, { lat: f.lat, lng: f.lng });
                return (
                  <li
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-border cursor-pointer hover:border-primary"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{f.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {f.prefecture} {f.city} · Rank {f.rank}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black tabular-nums whitespace-nowrap" style={{ color: "var(--color-gold)" }}>
                      {d < 10 ? d.toFixed(1) : Math.round(d)} km
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {selected && (
          <div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            style={{ background: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setSelected(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 bg-card border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-3">{selected.emoji}</div>
              <h3 className="text-xl font-black">{selected.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selected.prefecture} {selected.city}
              </p>
              <p className="text-sm mt-3">{selected.description}</p>
              <p className="text-xs text-muted-foreground mt-4">
                {selected.startDate} 〜 {selected.endDate} · Rank {selected.rank} · +{selected.xp} XP
              </p>
              <button
                onClick={() => setSelected(null)}
                className="w-full mt-5 py-2 rounded-lg bg-muted text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
