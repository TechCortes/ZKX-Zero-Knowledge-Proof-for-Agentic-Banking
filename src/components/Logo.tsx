/** ZQUENT monogram: a Z inside a hairline proof frame. */
export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="4" fill="#0A0B0D"/>
      <rect x="0.5" y="0.5" width="31" height="31" rx="3.5" stroke="#3DDC97"/>
      <path d="M10 10h12L10 22h12" stroke="#EDEEF0" strokeWidth="2.4" strokeLinecap="square"/>
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <span className="flex items-center gap-2.5" aria-label="ZQUENT">
      <LogoIcon size={28}/>
      <span className="font-display text-[15px] font-semibold tracking-[0.18em] text-zq-text leading-none">ZQUENT</span>
    </span>
  );
}

export function LogoCompact() {
  return (
    <span className="flex items-center gap-2" aria-label="ZQUENT">
      <LogoIcon size={22}/>
      <span className="font-display text-sm font-semibold tracking-[0.18em] text-zq-text leading-none">ZQUENT</span>
    </span>
  );
}
