export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Vero Protocol"
    >
      {/* Container — flat institutional indigo, matches the favicon */}
      <rect width="32" height="32" rx="6" fill="#3730A3"/>

      {/* Single diamond — the proof boundary, no nested shape */}
      <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="white"/>
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={32}/>
      <div className="leading-none">
        <p className="text-sm font-black tracking-tight text-white whitespace-nowrap" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}>Vero<span className="font-medium text-slate-400"> Protocol</span></p>
        <p className="text-[8.5px] text-slate-600 tracking-[0.20em] uppercase mt-[3px]" style={{ fontFamily: "ui-monospace, monospace" }}>Agent Compliance</p>
      </div>
    </div>
  );
}

export function LogoCompact() {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon size={24}/>
      <span className="text-sm font-black tracking-tight text-white whitespace-nowrap" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}>Vero<span className="font-medium text-slate-400"> Protocol</span></span>
    </div>
  );
}
