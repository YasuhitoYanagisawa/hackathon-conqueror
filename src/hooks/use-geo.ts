import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

const STORAGE_KEY = "matsuri-quest-geo-v1";

type GeoState = {
  pos: LatLng | null;
  error: string | null;
  loading: boolean;
};

export function useGeo() {
  const [state, setState] = useState<GeoState>({ pos: null, error: null, loading: false });

  // Hydrate from localStorage AFTER mount to avoid SSR/CSR mismatch
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ pos: JSON.parse(raw), error: null, loading: false });
    } catch {}
  }, []);


  function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ pos: null, error: "このブラウザでは位置情報を取得できません", loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
        } catch {}
        setState({ pos, error: null, loading: false });
      },
      (err) => {
        setState({ pos: null, error: err.message || "位置情報の取得に失敗しました", loading: false });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 * 30 },
    );
  }

  function clear() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState({ pos: null, error: null, loading: false });
  }

  useEffect(() => {}, []);
  return { ...state, request, clear };
}
