"use client";

import { useEffect, useState } from "react";
import { LAST_SPEC_KEY, loadWorldHandoff, type WorldHandoff } from "../../lib/world-handoff";

export function useWorldHandoff() {
  const [state, setState] = useState<{ handoff: WorldHandoff | null; error: string; ready: boolean }>({ handoff: null, error: "", ready: false });
  useEffect(() => {
    let revision = 0;
    const load = () => {
      const current = ++revision;
      void loadWorldHandoff(window.location.hash, () => {
        // Private browsing/storage policies should not prevent default lab scenes.
        try { return window.localStorage.getItem(LAST_SPEC_KEY); } catch { return null; }
      }).then(handoff => {
        if (current === revision) setState({ handoff, error: "", ready: true });
      }, cause => {
        if (current === revision) setState({ handoff: null, error: cause instanceof Error ? cause.message : "Could not load world specification.", ready: true });
      });
    };
    load();
    window.addEventListener("hashchange", load);
    return () => { revision++; window.removeEventListener("hashchange", load); };
  }, []);
  return state;
}
