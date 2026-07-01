"use client";

import { useEffect, useState } from "react";

/**
 * Reactive CSS media-query hook. Safe here because the app tree mounts
 * client-side only (behind the auth gate), so `window` is available at first
 * render and there's no hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
