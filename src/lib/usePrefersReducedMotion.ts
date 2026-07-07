"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the `prefers-reduced-motion: reduce` media query. Starts `false` on
 * the server / first render and updates in an effect, so it's SSR-safe.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
