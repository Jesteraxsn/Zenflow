"use client";

import { useCallback, useRef, useState } from "react";

export default function useToast(ms = 2500) {
  const [message, setMessage] = useState("");
  const timer = useRef(null);
  const show = useCallback(
    (text) => {
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(""), ms);
    },
    [ms],
  );
  return [message, show];
}
