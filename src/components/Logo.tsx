export function LogoIcon({ size = 32, id = "zkx" }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ZKX"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#6D28D9"/>
        </linearGradient>
      </defs>

      {/* Container — rx=6: institutional badge proportion */}
      <rect width="32" height="32" rx="6" fill={`url(#${id}-g)`}/>

      {/* Outer diamond — the commitment boundary.
          Visible but non-revealing: what the verifier is given. */}
      <path
        d="M16 4 L28 16 L16 28 L4 16 Z"
        stroke="white" strokeWidth="2" strokeOpacity="0.5"
        fill="white" fillOpacity="0.09"
        strokeLinejoin="miter"
      />

      {/* Inner diamond — the proof kernel.
          The verified truth: credential valid, age met. Nothing else. */}
      <path
        d="M16 10.5 L21.5 16 L16 21.5 L10.5 16 Z"
        fill="white" fillOpacity="0.93"
      />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={32} id="zkx-nav"/>
      <div className="leading-none">
        <p className="text-sm font-black tracking-tight text-white" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}>ZKX</p>
        <p className="text-[8.5px] text-slate-600 tracking-[0.20em] uppercase mt-[3px]" style={{ fontFamily: "ui-monospace, monospace" }}>Know Your Agent</p>
      </div>
    </div>
  );
}

export function LogoCompact() {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon size={24} id="zkx-compact"/>
      <span className="text-sm font-black tracking-tight text-white" style={{ fontFamily: "ui-monospace, 'JetBrains Mono', monospace" }}>ZKX</span>
    </div>
  );
}
