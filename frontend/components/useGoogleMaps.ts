"use client";

import { useEffect, useState } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Status = "idle" | "loading" | "ready" | "error" | "no-key";

let loadPromise: Promise<void> | null = null;

/**
 * Load the Google Maps JS API the classic way, pinned to the stable quarterly
 * channel. Without loading=async the full API is available the moment the
 * script fires onload, so google.maps.Map, Marker, and Circle are all ready.
 * This is the most compatible and reliable loader for the app.
 */
function loadScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    const w = window as unknown as { google?: { maps?: { Map?: unknown } } };
    if (w.google?.maps?.Map) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      "gmaps-js"
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "gmaps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=quarterly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

async function ensureMaps(): Promise<void> {
  const w = window as unknown as { google?: { maps?: { Map?: unknown } } };
  if (w.google?.maps?.Map) return;
  if (!loadPromise) loadPromise = loadScript();
  await loadPromise;
}

/** Loads the Google Maps JS API once and reports readiness. */
export function useGoogleMaps(): { status: Status } {
  const [status, setStatus] = useState<Status>(MAPS_KEY ? "idle" : "no-key");

  useEffect(() => {
    if (!MAPS_KEY) {
      setStatus("no-key");
      return;
    }
    setStatus("loading");
    ensureMaps()
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
  }, []);

  return { status };
}
