import type { ReactNode } from "react";
import clsx from "clsx";

/** Shared presentational primitives for the ZQUENT institutional look. No state, no data. */

export type Status = "live" | "optin" | "building" | "planned" | "classical";

const STATUS: Record<Status, { label: string; cls: string }> = {
  live:      { label: "Live",            cls: "border-zq-accent/40 text-zq-accent" },
  optin:     { label: "Shipped · opt-in", cls: "border-zq-accent/40 text-zq-accent" },
  building:  { label: "Building today",  cls: "border-zq-warn/40 text-zq-warn" },
  planned:   { label: "Planned",         cls: "border-zq-line-strong text-zq-muted" },
  classical: { label: "Classical",       cls: "border-zq-line-strong text-zq-soft" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={clsx("font-mono text-xs uppercase tracking-[0.08em] px-2 py-0.5 rounded border shrink-0 whitespace-nowrap", s.cls)}>
      {s.label}
    </span>
  );
}

export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={clsx("border-t border-zq-line px-4 sm:px-6 py-16 md:py-24", className)}>
      <div className="max-w-page mx-auto">{children}</div>
    </section>
  );
}

export function SectionHeader({
  index,
  label,
  title,
  lead,
  aside,
}: {
  index: string;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-10 md:mb-14 grid gap-6 md:grid-cols-12 md:items-end">
      <div className="md:col-span-8">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-zq-muted mb-4">
          <span className="text-zq-accent">{index}</span>
          <span className="mx-2 text-zq-faint">—</span>
          {label}
        </p>
        <h2 className="font-display text-[26px] sm:text-3xl md:text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-zq-text max-w-3xl">
          {title}
        </h2>
        {lead && <p className="mt-4 text-[15px] md:text-base leading-relaxed text-zq-muted max-w-2xl">{lead}</p>}
      </div>
      {aside && <div className="md:col-span-4 md:justify-self-end">{aside}</div>}
    </div>
  );
}

/** Mono, uppercase micro-label used above data. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("font-mono text-xs uppercase tracking-[0.12em] text-zq-muted", className)}>{children}</p>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-md border border-zq-line bg-zq-surface", className)}>{children}</div>;
}

/** Panel header for code / terminal blocks (replaces the old traffic-light dots). */
export function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zq-line">
      <span className="font-mono text-xs text-zq-muted truncate">{children}</span>
      <span className="font-mono text-xs text-zq-faint shrink-0">zquent</span>
    </div>
  );
}

const BUTTON = {
  primary:
    "bg-zq-accent text-zq-bg hover:bg-zq-accent-strong border border-zq-accent",
  secondary:
    "border border-zq-line-strong text-zq-text hover:border-zq-soft",
  ghost:
    "text-zq-soft hover:text-zq-text",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  external,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON;
  external?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={clsx(
        "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded text-sm font-medium transition-colors",
        BUTTON[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg className={clsx("w-3.5 h-3.5 shrink-0", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="square" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function Cross({ className }: { className?: string }) {
  return (
    <svg className={clsx("w-3.5 h-3.5 shrink-0", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="square" strokeWidth={2.5} d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export const GITHUB_URL = "https://github.com/TechCortes/ZKX-Zero-Knowledge-Proof-for-Agentic-Banking";
export const OWS_URL = "https://openwallet.sh/";
