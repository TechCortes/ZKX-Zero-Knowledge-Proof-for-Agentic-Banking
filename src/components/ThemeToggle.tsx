"use client";

/**
 * Light / dark switch for readers.
 *
 * The theme is the `data-theme` attribute on <html> ("light" | "dark"); every
 * colour token reads from it (src/app/globals.css). A reader's choice is saved in
 * localStorage. With no saved choice, THEME_INIT_SCRIPT follows the OS setting.
 * That script runs in <head> before first paint, so the page never flashes the
 * wrong theme.
 *
 * Which icon shows is decided by CSS from the same attribute, so the server
 * render and the first client render are identical.
 */

export const THEME_STORAGE_KEY = "zquent_theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the switch still works for this visit.
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
      className={`group inline-flex items-center justify-center gap-2 h-11 min-w-[44px] lg:h-10 lg:min-w-[40px] px-2.5 rounded border border-zq-line-strong text-zq-text hover:border-zq-soft transition-colors ${className}`}
    >
      {/* Shown in light mode: offers dark. */}
      <span className="flex items-center gap-2 [[data-theme=dark]_&]:hidden">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
        <span className="sr-only xl:not-sr-only text-sm">Dark mode</span>
      </span>
      {/* Shown in dark mode: offers light. */}
      <span className="hidden items-center gap-2 [[data-theme=dark]_&]:flex">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
        <span className="sr-only xl:not-sr-only text-sm">Light mode</span>
      </span>
    </button>
  );
}
