"use client";

import { useEffect, useRef, type RefObject } from "react";

import { bindMovementKeys } from "./keyboard";

/** Read keys.current inside the renderer loop without causing per-key React renders. */
export function useMovement(surface: RefObject<HTMLElement | null>) {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    if (!surface.current) return;
    return bindMovementKeys(surface.current, keys.current);
  }, [surface]);
  return keys;
}
