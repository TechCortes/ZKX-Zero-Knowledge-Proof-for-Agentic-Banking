"use client";

export function ZKXFacilitator({ className }: { className?: string }) {
  return (
    <div className={`relative select-none ${className ?? ""}`}>
      {/* Ambient glow behind character */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 320 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full zkx-float"
        aria-label="ZKX — Know Your Agent facilitator"
      >
        <defs>
          <linearGradient id="cape" x1="100" y1="100" x2="280" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="suit" x1="70" y1="155" x2="130" y2="310" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <radialGradient id="skin" cx="45%" cy="38%" r="55%">
            <stop offset="0%" stopColor="#fbbf9a" />
            <stop offset="100%" stopColor="#e8a87c" />
          </radialGradient>
          <radialGradient id="orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Motion trail / speed lines ── */}
        <g opacity="0.12" strokeLinecap="round">
          <line x1="0" y1="92"  x2="42" y2="102" stroke="white" strokeWidth="2.5" />
          <line x1="0" y1="120" x2="38" y2="122" stroke="white" strokeWidth="2" />
          <line x1="0" y1="148" x2="40" y2="144" stroke="white" strokeWidth="1.5" />
          <line x1="2" y1="172" x2="42" y2="168" stroke="white" strokeWidth="1" />
        </g>

        {/* ── Cape ── */}
        <path
          d="M 102 160 Q 165 96 265 68 Q 298 132 272 184 Q 222 214 158 212 Q 120 212 106 196 Z"
          fill="url(#cape)"
        />
        <path
          d="M 110 162 Q 168 108 252 80 Q 272 126 254 170"
          stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" strokeLinecap="round"
        />
        <path
          d="M 112 194 Q 148 208 198 210 Q 170 200 148 192 Z"
          fill="rgba(0,0,0,0.12)"
        />

        {/* ── Hair ── */}
        <path
          d="M 58 90 Q 80 58 118 60 Q 178 52 232 76 Q 198 92 162 96 Q 128 99 94 98 Q 72 100 58 112 Z"
          fill="#1a1a2e"
        />
        <path
          d="M 68 88 Q 125 64 208 78 Q 178 90 144 94 Q 108 97 70 102"
          stroke="#2d2d4e" strokeWidth="3" fill="none" strokeLinecap="round"
        />
        <path
          d="M 82 84 Q 145 67 218 80 Q 190 90 158 93"
          stroke="#2d2d4e" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"
        />

        {/* ── Head ── */}
        <ellipse cx="82" cy="124" rx="38" ry="40" fill="url(#skin)" />
        <ellipse cx="44" cy="124" rx="6" ry="9" fill="#fbbf9a" />

        {/* ── Mask / visor ── */}
        <path
          d="M 50 117 Q 62 107 82 111 Q 102 107 116 117 Q 109 132 82 129 Q 54 132 50 117 Z"
          fill="#1e1b4b"
        />
        <path
          d="M 54 114 Q 65 107 82 111 Q 70 117 56 118 Z"
          fill="rgba(255,255,255,0.14)"
        />
        {/* Visor glow */}
        <path
          d="M 54 120 Q 68 113 82 116 Q 96 113 110 120"
          stroke="#818cf8" strokeWidth="1" fill="none" opacity="0.55"
        />

        {/* ── Face details ── */}
        <path d="M 70 147 Q 82 152 94 147" stroke="#d97b6c" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 78 134 Q 76 141 80 145" stroke="#d4905a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />

        {/* ── Neck ── */}
        <rect x="72" y="160" width="20" height="18" rx="4" fill="#fbbf9a" />

        {/* ── Torso ── */}
        <path
          d="M 70 176 Q 92 172 118 177 L 126 234 Q 98 242 70 234 Z"
          fill="url(#suit)"
        />
        {/* Costume center line */}
        <line x1="83" y1="177" x2="83" y2="232" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* ── Chest shield (ZK emblem) ── */}
        <path d="M 85 184 L 94 175 L 105 184 L 101 200 L 85 200 Z" fill="white" opacity="0.93" />
        <text x="87" y="195" fontSize="9" fontWeight="800" fill="#1d4ed8" fontFamily="monospace" letterSpacing="-0.5">ZK</text>

        {/* ── Belt ── */}
        <rect x="70" y="230" width="57" height="11" rx="3" fill="#312e81" />
        <rect x="88" y="228" width="20" height="15" rx="3" fill="#4f46e5" />
        <text x="91" y="239" fontSize="6.5" fill="white" fontWeight="700" fontFamily="monospace" letterSpacing="0.5">KYA</text>

        {/* ── Leading arm (extends right — flying) ── */}
        <path
          d="M 115 182 Q 168 170 220 164 Q 223 178 172 188 Q 132 192 115 194 Z"
          fill="#fbbf9a"
        />
        {/* Glove */}
        <path
          d="M 206 163 Q 226 158 236 169 Q 232 183 216 183 Q 202 181 200 172 Z"
          fill="#1d4ed8" opacity="0.75"
        />
        {/* Fist */}
        <ellipse cx="222" cy="172" rx="13" ry="11" fill="#fbbf9a" />

        {/* ── Trailing arm ── */}
        <path
          d="M 72 188 Q 46 200 30 218 Q 38 227 48 221 Q 60 207 74 198 Z"
          fill="#fbbf9a"
        />

        {/* ── Legs ── */}
        <path d="M 82 240 Q 90 282 104 316 Q 92 324 82 318 Q 67 282 67 242 Z" fill="url(#suit)" />
        <path d="M 100 242 Q 113 284 125 316 Q 113 324 103 320 Q 88 284 87 244 Z" fill="url(#suit)" />

        {/* ── Boots ── */}
        <path d="M 68 314 Q 72 334 76 342 Q 84 348 90 342 Q 94 332 91 316 Z" fill="#312e81" />
        <path d="M 71 318 Q 74 332 78 340" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 88 316 Q 94 334 98 342 Q 106 348 110 342 Q 114 332 112 318 Z" fill="#312e81" />
        <path d="M 91 320 Q 95 332 98 340" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* ── ZK Proof orb on fist ── */}
        <circle cx="246" cy="166" r="18" fill="none" stroke="#818cf8" strokeWidth="1" strokeDasharray="3 2.5" opacity="0.5" filter="url(#glow)" />
        <circle cx="246" cy="166" r="10" fill="url(#orb)" opacity="0.7" />
        <circle cx="246" cy="166" r="4" fill="white" opacity="0.9" />

        {/* Orb particles */}
        <circle cx="262" cy="152" r="2.5" fill="#818cf8" opacity="0.7" />
        <circle cx="268" cy="168" r="1.8" fill="#60a5fa" opacity="0.55" />
        <circle cx="258" cy="180" r="2" fill="#a78bfa" opacity="0.6" />
        <circle cx="272" cy="158" r="1.2" fill="white" opacity="0.45" />
        <circle cx="256" cy="148" r="1.5" fill="#c4b5fd" opacity="0.5" />

        {/* Proof circuit lines from orb */}
        <path d="M 256 158 Q 270 148 278 152" stroke="#818cf8" strokeWidth="0.8" fill="none" opacity="0.4" strokeLinecap="round" />
        <path d="M 258 174 Q 272 176 278 170" stroke="#60a5fa" strokeWidth="0.8" fill="none" opacity="0.35" strokeLinecap="round" />
      </svg>
    </div>
  );
}
