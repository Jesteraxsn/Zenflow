"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SEEN_KEY = "zf-splash-seen";
const MIN_VISIBLE_MS = 900; // long enough to register, short enough not to annoy

// Full-screen ZenFlow logo shown when the web app is first opened (once per browser tab session).
// It is part of the server HTML, so it appears before any JavaScript runs.

// Runs inline before the splash is painted: if it was already shown in this tab, hide it via CSS.
// The server sends it as a normal script; in the browser React renders it as inert text/plain, so it
// never runs twice and React doesn't warn about script tags.
const seenScript = `try{if(sessionStorage.getItem("${SEEN_KEY}")==="1")document.documentElement.classList.add("zf-no-splash")}catch(e){}`;

export default function SplashScreen() {
  const [phase, setPhase] = useState("show"); // show → hide (fading) → gone

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    if (seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- already hidden by CSS; just unmount
      setPhase("gone");
      return;
    }
    // performance.now() counts from when the page started opening.
    const fade = () => setTimeout(() => setPhase("hide"), Math.max(0, MIN_VISIBLE_MS - performance.now()));
    let timer;
    if (document.readyState === "complete") timer = fade();
    else window.addEventListener("load", () => (timer = fade()), { once: true });
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "hide") return;
    const t = setTimeout(() => setPhase("gone"), 600);
    return () => clearTimeout(t);
  }, [phase]);

  const gate = (
    <script
      suppressHydrationWarning
      type={typeof window === "undefined" ? undefined : "text/plain"}
      dangerouslySetInnerHTML={{ __html: seenScript }}
    />
  );
  if (phase === "gone") return gate;

  return (
    <>
    {gate}
    <div id="zf-splash" className={phase === "hide" ? "zf-splash-hide" : ""} role="status" aria-label="Loading ZenFlow">
      <div className="zf-splash-mark">
        <span className="zf-splash-ring" aria-hidden="true" />
        <Image src="/zenflow-logo.png" alt="ZenFlow" width={128} height={128} priority className="zf-splash-logo" />
      </div>
      <p className="zf-splash-text">Preparing your sanctuary…</p>
    </div>
    </>
  );
}
