"use client";

import { useEffect, useState } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Status = "idle" | "loading" | "ready" | "error" | "no-key";

let loadPromise: Promise<void> | null = null;

function injectBootstrap(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const w = window as unknown as {
      google?: { maps?: { importLibrary?: unknown } };
    };
    // Bootstrap already present (for example after a hot reload).
    if (w.google?.maps?.importLibrary) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * Load the Google Maps JS API and the "maps" library. With the async loader the
 * constructors (Map, Marker, Circle) only exist after importLibrary resolves,
 * so we await it before reporting ready.
 */
async function ensureMaps(): Promise<void> {
  const w = window as unknown as {
    google?: { maps?: { Map?: unknown; importLibrary?: (name: string) => Promise<unknown> } };
  };
  if (w.google?.maps?.Map) return;
  if (!loadPromise) loadPromise = injectBootstrap();
  await loadPromise;
  await w.google!.maps!.importLibrary!("maps");
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
