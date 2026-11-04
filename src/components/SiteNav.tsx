"use client";

import { useEffect, useRef, useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { GITHUB_URL, OWS_URL } from "@/components/ui";

/**
 * Site header. Desktop: inline links. Below 1024 px: a menu button opening a
 * full-width sheet with every link (closes on link tap and Escape; focus stays
 * inside while open). "Live demo" stays visible in the bar at every width.
 *
 * `base` prefixes in-page anchors so the same nav works on /register ("/").
 */
export default function SiteNav({ base = "" }: { base?: "" | "/" }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const links = [
    { href: `${base}#how-it-works`, label: "Protocol" },
    { href: `${base}#post-quantum`, label: "Post-quantum" },
    { href: `${base}#architecture`, label: "Architecture" },
    { href: `${base}#founder`, label: "Founder" },
    { href: OWS_URL, label: "OWS ↗", external: true },
    { href: GITHUB_URL, label: "GitHub ↗", external: true },
  ];

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const focusables = () => Array.from(sheet?.querySelectorAll<HTMLElement>("a, button") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-zq-line bg-zq-surface/90 backdrop-blur">
      <div className="max-w-page mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href={base || "/"} className="shrink-0" aria-label="ZQUENT home">
          <LogoWordmark />
        </a>

        <div className="hidden lg:flex items-center gap-6 whitespace-nowrap">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="text-sm text-zq-muted hover:text-zq-text transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/register"
            className="hidden sm:inline-flex items-center whitespace-nowrap min-h-[40px] px-4 rounded border border-zq-line-strong text-sm text-zq-text hover:border-zq-soft transition-colors"
          >
            Register an agent
          </a>
          <a
            href={`${base}#demo`}
            className="inline-flex items-center whitespace-nowrap min-h-[40px] px-4 rounded bg-zq-accent text-zq-on-accent text-sm font-medium hover:bg-zq-accent-strong transition-colors"
          >
            Live demo
          </a>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded border border-zq-line-strong text-zq-text"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              {open
                ? <path strokeLinecap="square" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                : <path strokeLinecap="square" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="site-menu"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="lg:hidden border-t border-zq-line bg-zq-bg px-4 pb-6"
        >
          <ul className="divide-y divide-zq-line">
            {[{ href: `${base}#demo`, label: "Live demo" }, { href: "/register", label: "Register an agent" }, ...links].map((l) => (
              <li key={`m-${l.href}`}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  {...("external" in l && l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="flex items-center justify-between min-h-[52px] text-base text-zq-text"
                >
                  {l.label}
                  <span className="font-mono text-xs text-zq-faint">→</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
