"use client";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  // The visible icon is chosen entirely by CSS from html[data-theme], so there
  // is no hydration mismatch and no flash — this handler just flips the attr.
  const toggle = () => {
    const cur = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    const next: Theme = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mv-theme", next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle light/dark theme"
    >
      <span className="ic-sun" aria-hidden>☀️</span>
      <span className="ic-moon" aria-hidden>🌙</span>
    </button>
  );
}
