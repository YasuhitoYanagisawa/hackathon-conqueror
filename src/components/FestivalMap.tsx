import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Festival } from "@/data/festivals";
import { heatColor, countByPrefecture, type LatLng } from "@/lib/geo";

type PrefProps = { nam_ja: string; nam?: string; id?: number };

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
  upcoming,
  userPos,
  onSelect,
}: {
  festivals: Festival[];
  upcoming: Festival[];
  userPos: LatLng | null;
  onSelect: (f: Festival) => void;
}) {
  const center: [number, number] = userPos ? [userPos.lat, userPos.lng] : [37.5, 138.2];
  const zoom = userPos ? 9 : 5;

  const counts = useMemo(() => countByPrefecture(festivals), [festivals]);
  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(counts)),
    [counts],
  );

  // Load GeoJSON client-side (lazy fetch — avoids bundling 150KB into JS chunk)
  const [geo, setGeo] = useState<FeatureCollection<any, PrefProps> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/japan-prefectures.geojson")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setGeo(j);
      })
      .catch((e) => console.error("GeoJSON load failed", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const markers = useMemo(
    () =>
      upcoming
        .filter((f) => typeof f.lat === "number" && typeof f.lng === "number" && !isNaN(f.lat))
        .slice(0, 1500),
    [upcoming],
  );

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }, []);

  const styleFn = (feature?: Feature<any, PrefProps>) => {
    const pref = feature?.properties.nam_ja ?? "";
    const c = counts[pref] ?? 0;
    const t = c / maxCount;
    return {
      color: "oklch(0.4 0.05 250 / 0.6)",
      weight: 0.8,
      fillColor: heatColor(t),
      fillOpacity: c === 0 ? 0.05 : 0.25 + t * 0.55,
    };
  };

  const onEachFeature = (feature: Feature<any, PrefProps>, layer: L.Layer) => {
    const pref = feature.properties.nam_ja;
    const c = counts[pref] ?? 0;
    (layer as L.Path).bindTooltip(
      `<strong>${pref}</strong><br/>年間 ${c.toLocaleString()} 件`,
      { sticky: true, direction: "top", className: "matsuri-tooltip" },
    );
    layer.on({
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ weight: 2, color: "#ffd700", fillOpacity: 0.7 });
        l.bringToFront();
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        l.setStyle(styleFn(feature));
      },
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 560 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: "#0b0d1a" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO &copy; dataofjapan/land'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {geo && (
          <GeoJSON
            key={`geo-${maxCount}`}
            data={geo}
            style={styleFn as any}
            onEachFeature={onEachFeature as any}
          />
        )}

        {markers.map((f) => (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={f.rank === "S" ? 7 : f.rank === "A" ? 5 : 3.5}
            pathOptions={{
              color: "#0b0d1a",
              fillColor: rankColor(f.rank),
              fillOpacity: 0.95,
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
