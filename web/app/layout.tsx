import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "./ThemeToggle";

export const metadata: Metadata = {
  title: "MacVitals — check any Mac's health",
  description:
    "Run one read-only command on a Mac, then drop the report here for a plain-English health verdict. Everything is analyzed in your browser — nothing is uploaded.",
};

// Resolve the theme BEFORE first paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('mv-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
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
