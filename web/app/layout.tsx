import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "./ThemeToggle";
import Reveal from "./Reveal";

export const metadata: Metadata = {
  title: "MacVitals — check any Mac's health",
  description:
    "Run one read-only command on a Mac, then drop the report here for a plain-English health verdict. Everything is analyzed in your browser — nothing is uploaded.",
};

// Runs BEFORE first paint: resolve the theme (no flash) and, unless the user
// prefers reduced motion, arm the reveal-on-scroll animations.
const bootScript = `(function(){try{var t=localStorage.getItem('mv-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!rm){document.documentElement.classList.add('reveal-ready');}}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <Reveal />
        <div className="wrap">
          <nav className="nav">
            <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="brand">
                <span className="logo">✦</span>
                Mac<span className="dot">Vitals</span>
              </span>
            </a>
            <div className="nav-right">
              <a href="/report/">Analyze a report</a>
              <a href="/#get">Get the tool</a>
              <ThemeToggle />
            </div>
          </nav>
          {children}
          <div className="footer">
            MacVitals runs entirely on your device. Your report never leaves your browser. · MIT licensed
          </div>
        </div>
      </body>
    </html>
  );
}
