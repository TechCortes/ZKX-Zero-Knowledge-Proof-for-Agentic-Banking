/**
 * The ZQUENT mark: a geometric Z on a navy tile. Same shape as the favicon (src/app/icon.svg).
 * The tile follows the theme: navy with a white Z in light mode, light with a navy Z in dark
 * mode, so it never disappears into the background.
 */
export const Z_PATH = "M9 8.5H23V11.5L13.2 20.5H23V23.5H9V20.5L18.8 11.5H9Z";

export function LogoIcon({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="7" className={inverted ? "fill-zq-surface" : "fill-zq-text"}/>
      <path d={Z_PATH} className={inverted ? "fill-zq-text" : "fill-zq-surface"}/>
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <span className="flex items-center gap-2.5" aria-label="ZQUENT">
      <LogoIcon size={30}/>
      <span className="font-display text-base font-semibold tracking-[0.14em] text-zq-text leading-none">ZQUENT</span>
    </span>
  );
}

export function LogoCompact() {
  return (
    <span className="flex items-center gap-2" aria-label="ZQUENT">
      <LogoIcon size={22}/>
      <span className="font-display text-sm font-semibold tracking-[0.14em] text-zq-text leading-none">ZQUENT</span>
    </span>
  );
}
