export function LogoIcon({ size = 32, id = "zkx-bg" }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ZKX — Know Your Agent"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      {/* Outer dashed ring — the hidden agent identity */}
      <circle
        cx="16" cy="16" r="10"
        stroke="white" strokeOpacity="0.35"
        strokeWidth="1.25" strokeDasharray="2.5 2"
        fill="none"
      />
      {/* Inner fill — the proof space */}
      <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.12" />
      {/* Checkmark — verified without revealing */}
      <path
        d="M12.5 16l2.5 2.5 4.5-4.5"
        stroke="white" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={32} id="zkx-nav-bg" />
      <div className="leading-none">
        <p className="text-sm font-bold tracking-tight text-white">ZKX</p>
        <p className="text-[9px] text-slate-600 tracking-[0.18em] uppercase mt-[3px]">Know Your Agent</p>
      </div>
    </div>
  );
}

export function LogoCompact() {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon size={24} id="zkx-compact-bg" />
      <span className="text-sm font-bold tracking-tight text-white">ZKX</span>
    </div>
  );
}
