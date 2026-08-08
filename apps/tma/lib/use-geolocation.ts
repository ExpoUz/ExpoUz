"use client";

import { useEffect, useState } from "react";

export interface GeoState {
  lat?: number;
  lng?: number;
  granted: boolean;
  asked: boolean;
}

/**
 * Non-blocking geolocation. Attempts a single low-cost read on mount and never
 * blocks the UI: if the user denies or the browser has no location, we simply
 * report `granted: false` and callers fall back to city/district. We never show
 * a permission prompt gate — the home feed must render either way.
 */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ granted: false, asked: false });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ granted: false, asked: true });
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, granted: true, asked: true });
      },
      () => {
        if (cancelled) return;
        setState({ granted: false, asked: true });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );
    return () => { cancelled = true; };
  }, []);

  return state;
}
