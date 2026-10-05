"use client";

import { useEffect, useState } from "react";

// Current time as state, refreshed on an interval, so renders stay pure.
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
