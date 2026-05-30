import { useState } from "react";

// Theme toggle — deliberately simple.
// The Base.astro bootstrap has ALREADY set data-theme on <html> before paint.
// We read it synchronously in the useState initializer (runs during first
// render, so it sees the correct value — no race, no default-guess flash).
// Two static SVG icons swap; nothing animates geometry.

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light"; // SSR guard
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("strided-theme", next);
    } catch {
      /* storage blocked — still works for the session */
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
    >
      {isDark ? (
        // moon — static crescent (single path, no animation)
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
             strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // sun — static disc + rays
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
             strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <line x1="12" y1="1.5" x2="12" y2="3.8" />
          <line x1="12" y1="20.2" x2="12" y2="22.5" />
          <line x1="3.9" y1="3.9" x2="5.5" y2="5.5" />
          <line x1="18.5" y1="18.5" x2="20.1" y2="20.1" />
          <line x1="1.5" y1="12" x2="3.8" y2="12" />
          <line x1="20.2" y1="12" x2="22.5" y2="12" />
          <line x1="3.9" y1="20.1" x2="5.5" y2="18.5" />
          <line x1="18.5" y1="5.5" x2="20.1" y2="3.9" />
        </svg>
      )}
    </button>
  );
}
