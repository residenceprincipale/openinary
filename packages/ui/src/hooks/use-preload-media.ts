"use client";

import { useEffect, useRef } from "react";

// Global cache to prevent duplicate preloads across components. Bounded: a
// long browsing session over thousands of thumbnails must not keep every URL
// (and the browser image it maps to) alive.
const MAX_PRELOADED = 200;
const globalPreloadedCache = new Set<string>();

function rememberPreload(url: string): void {
  if (globalPreloadedCache.size >= MAX_PRELOADED) {
    const oldest = globalPreloadedCache.values().next().value;
    if (oldest) globalPreloadedCache.delete(oldest);
  }
  globalPreloadedCache.add(url);
}

/**
 * Check if connection is slow (using Network Information API if available)
 */
function isSlowConnection(): boolean {
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      // Skip preloading on slow connections (2G, slow-2G, or save-data mode)
      return (
        connection.effectiveType === "2g" ||
        connection.effectiveType === "slow-2g" ||
        connection.saveData === true
      );
    }
  }
  return false;
}

/**
 * Hook to preload media (images or videos) for faster display
 * Only preloads if not already cached and connection is not slow
 */
export function usePreloadMedia(url: string | null, type: "image" | "video") {
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!url) return;

    // Skip if already preloaded globally
    if (globalPreloadedCache.has(url)) return;
    if (preloadedRef.current.has(url)) return;

    // Skip preloading on slow connections to save bandwidth
    if (isSlowConnection()) return;

    if (type === "image") {
      const img = new Image();
      img.src = url;
      rememberPreload(url);
      preloadedRef.current.add(url);
    } else {
      const video = document.createElement("video");
      video.src = url;
      video.preload = "auto";
      rememberPreload(url);
      preloadedRef.current.add(url);
    }
  }, [url, type]);
}

/**
 * Preload a media URL immediately (for use in event handlers)
 * Only preloads if not already cached and connection is not slow
 */
export function preloadMedia(url: string, type: "image" | "video") {
  // Skip if already preloaded
  if (globalPreloadedCache.has(url)) return;

  // Skip preloading on slow connections to save bandwidth
  if (isSlowConnection()) return;

  if (type === "image") {
    const img = new Image();
    img.src = url;
    rememberPreload(url);
  } else {
    const video = document.createElement("video");
    video.src = url;
    video.preload = "auto";
    rememberPreload(url);
  }
}
