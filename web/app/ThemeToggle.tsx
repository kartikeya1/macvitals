"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read the theme the inline <head> script already resolved before paint.
  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mv-theme", next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    setTheme(next);
  };

  // Render a stable placeholder until mounted to avoid a hydration mismatch.
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      suppressHydrationWarning
    >
      {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : "◐"}
    </button>
  );
}
