"use client";

import { useCallback, useEffect, useState } from "react";

// Runs an async loader on mount and whenever `deps` change.
// Optional `pollMs` re-runs it on an interval (used for live staff views).
export default function useAsync(loader, deps = [], { pollMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })),
    [],
  );

  return { ...state, reload, setData };
}
