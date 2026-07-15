"use client";

import { useEffect, useState } from "react";

type Detect = { isMac: boolean; osLabel: string } | null;

function detectPlatform(): Detect {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const plat = navigator.platform || "";
  const touch = navigator.maxTouchPoints || 0;

  const isIOS = /iPhone|iPad|iPod/.test(ua);
  // iPadOS Safari masquerades as "MacIntel" but reports touch points > 1.
  const isIpadAsMac = /Mac/i.test(plat) && touch > 1;
  const looksMac = (/Mac/i.test(plat) || /Mac OS X/i.test(ua)) && !isIOS && !isIpadAsMac;

  let osLabel = "your device";
  if (isIOS || isIpadAsMac) osLabel = "an iPhone / iPad";
  else if (/Windows/i.test(ua)) osLabel = "Windows";
  else if (/Android/i.test(ua)) osLabel = "Android";
  else if (/Linux/i.test(ua)) osLabel = "Linux";
  else if (looksMac) osLabel = "a Mac";

  return { isMac: looksMac, osLabel };
}

export default function MacCheck() {
  const [d, setD] = useState<Detect>(null);

  useEffect(() => setD(detectPlatform()), []);

  // Neutral placeholder during SSR / before detection (prevents hydration flash).
  if (!d) {
    return (
      <div className="macbanner">
        <span className="ico">💻</span>
        <div className="body">
          <b>Checking your device…</b>
          <span>MacVitals runs on macOS. We&apos;ll confirm what you&apos;re on in a moment.</span>
        </div>
      </div>
    );
  }

  if (d.isMac) {
    return (
      <div className="macbanner ok">
        <span className="ico">✅</span>
        <div className="body">
          <b>You&apos;re on a Mac — you&apos;re good to go.</b>
          <span>Copy the command below and run it in Terminal to check this machine.</span>
        </div>
        <a className="btn small" href="#get">Get the command</a>
      </div>
    );
  }

  return (
    <div className="macbanner no">
      <span className="ico">⚠️</span>
      <div className="body">
        <b>Looks like you&apos;re on {d.osLabel}.</b>
        <span>
          MacVitals only runs on macOS — but you can still see exactly what it produces by loading a
          sample report.
        </span>
      </div>
      <a className="btn small secondary" href="/report/">See a sample →</a>
    </div>
  );
}
