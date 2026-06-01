import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Festival } from "@/data/festivals";
import { heatColor, xpByPrefecture, type LatLng } from "@/lib/geo";

// Prefecture approximate centroids (rough, for heatmap visualization).
const PREF_CENTROIDS: Record<string, [number, number]> = {
  北海道: [43.06, 141.35], 青森県: [40.82, 140.74], 岩手県: [39.7, 141.15],
  宮城県: [38.27, 140.87], 秋田県: [39.72, 140.1], 山形県: [38.24, 140.36],
  福島県: [37.75, 140.47], 茨城県: [36.34, 140.45], 栃木県: [36.57, 139.88],
  群馬県: [36.39, 139.06], 埼玉県: [35.86, 139.65], 千葉県: [35.6, 140.12],
  東京都: [35.69, 139.69], 神奈川県: [35.45, 139.64], 新潟県: [37.9, 139.02],
  富山県: [36.7, 137.21], 石川県: [36.59, 136.63], 福井県: [36.07, 136.22],
  山梨県: [35.66, 138.57], 長野県: [36.65, 138.18], 岐阜県: [35.39, 136.72],
  静岡県: [34.98, 138.38], 愛知県: [35.18, 136.91], 三重県: [34.73, 136.51],
  滋賀県: [35.0, 135.87], 京都府: [35.02, 135.76], 大阪府: [34.69, 135.52],
  兵庫県: [34.69, 135.18], 奈良県: [34.69, 135.83], 和歌山県: [34.23, 135.17],
  鳥取県: [35.5, 134.24], 島根県: [35.47, 133.05], 岡山県: [34.66, 133.93],
  広島県: [34.4, 132.46], 山口県: [34.19, 131.47], 徳島県: [34.07, 134.56],
  香川県: [34.34, 134.04], 愛媛県: [33.84, 132.77], 高知県: [33.56, 133.53],
  福岡県: [33.61, 130.42], 佐賀県: [33.25, 130.3], 長崎県: [32.74, 129.87],
  熊本県: [32.79, 130.74], 大分県: [33.24, 131.61], 宮崎県: [31.91, 131.42],
  鹿児島県: [31.56, 130.56], 沖縄県: [26.21, 127.68],
};

function rankColor(rank: Festival["rank"]) {
  return rank === "S"
    ? "#ffb84d"
    : rank === "A"
      ? "#f97373"
      : rank === "B"
        ? "#7aa2ff"
        : "#9aa0ad";
}

export function FestivalMap({
  festivals,
  userPos,
  onSelect,
}: {
  festivals: Festival[];
  userPos: LatLng | null;
  onSelect: (f: Festival) => void;
}) {
  // Center on user, else Japan center
  const center: [number, number] = userPos ? [userPos.lat, userPos.lng] : [36.2, 138.2];
  const zoom = userPos ? 9 : 5;

  // Heatmap: total XP per prefecture
  const heat = useMemo(() => {
    const totals = xpByPrefecture(festivals);
    const max = Math.max(1, ...Object.values(totals));
    return Object.entries(totals).map(([pref, xp]) => {
      const c = PREF_CENTROIDS[pref];
      if (!c) return null;
      const t = xp / max;
      return {
        pref,
        xp,
        center: c,
        radius: 30000 + t * 90000, // 30-120km
        color: heatColor(t),
        t,
      };
    }).filter(Boolean) as Array<{
      pref: string; xp: number; center: [number, number]; radius: number; color: string; t: number;
    }>;
  }, [festivals]);

  // Limit markers for performance (nearest if user pos, else top by XP)
  const markers = useMemo(() => {
    const valid = festivals.filter(
      (f) => typeof f.lat === "number" && typeof f.lng === "number" && !isNaN(f.lat),
    );
    return valid.slice(0, 800);
  }, [festivals]);

  useEffect(() => {
    // Fix default icon path (not used since we use CircleMarker, but safe)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 560 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: "#0b0d1a" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {heat.map((h) => (
          <Circle
            key={`heat-${h.pref}`}
            center={h.center}
            radius={h.radius}
            pathOptions={{
              color: h.color,
              fillColor: h.color,
              fillOpacity: 0.12 + h.t * 0.18,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{h.pref}</strong>
              <br />
              総XP: {h.xp.toLocaleString()}
            </Popup>
          </Circle>
        ))}

        {markers.map((f) => (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={f.rank === "S" ? 8 : f.rank === "A" ? 6 : 4}
            pathOptions={{
              color: rankColor(f.rank),
              fillColor: rankColor(f.rank),
              fillOpacity: 0.85,
              weight: 1,
            }}
            eventHandlers={{ click: () => onSelect(f) }}
          >
            <Popup>
              <strong>{f.name}</strong>
              <br />
              {f.prefecture} {f.city}
              <br />
              Rank {f.rank} · +{f.xp} XP
              <br />
              {f.startDate}〜{f.endDate}
            </Popup>
          </CircleMarker>
        ))}

        {userPos && (
          <CircleMarker
            center={[userPos.lat, userPos.lng]}
            radius={10}
            pathOptions={{
              color: "#ffd700",
              fillColor: "#ffd700",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>あなたの現在地</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
