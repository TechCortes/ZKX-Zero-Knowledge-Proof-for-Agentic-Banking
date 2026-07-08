"use client";

export function ZKXFacilitator({ className }: { className?: string }) {
  return (
    <div className={`relative select-none ${className ?? ""}`}>
      {/* Ambient glow layers */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-700/18 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-2/3 -translate-x-1/2 w-48 h-48 bg-blue-700/12 rounded-full blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 420 540"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full zkx-float"
        aria-label="Vera — ZKX Know Your Agent"
      >
        <defs>
          {/* ── Suit ── */}
          <linearGradient id="vSuit" x1="0.25" y1="0" x2="0.75" y2="1">
            <stop offset="0%"   stopColor="#4C35A8"/>
            <stop offset="55%"  stopColor="#2C1C6B"/>
            <stop offset="100%" stopColor="#1A0E3D"/>
          </linearGradient>
          <linearGradient id="vSuitLeg" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%"   stopColor="#3A25A0"/>
            <stop offset="100%" stopColor="#140830"/>
          </linearGradient>
          <linearGradient id="vSuitArm" x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0%"   stopColor="#3D28A8"/>
            <stop offset="100%" stopColor="#1A0E48"/>
          </linearGradient>

          {/* ── Cape ── */}
          <linearGradient id="vCapeExt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#1C0E48"/>
            <stop offset="100%" stopColor="#0A0520"/>
          </linearGradient>
          <linearGradient id="vCapeInt" x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0%"   stopColor="#6040D8"/>
            <stop offset="100%" stopColor="#3A22A8"/>
          </linearGradient>

          {/* ── Skin ── */}
          <radialGradient id="vSkinFace" cx="42%" cy="32%" r="60%">
            <stop offset="0%"   stopColor="#F2BC9A"/>
            <stop offset="100%" stopColor="#C47850"/>
          </radialGradient>
          <linearGradient id="vSkinLimb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#DCA070"/>
            <stop offset="100%" stopColor="#C07048"/>
          </linearGradient>

          {/* ── Gold badge ── */}
          <radialGradient id="vGold" cx="38%" cy="32%" r="62%">
            <stop offset="0%"   stopColor="#F5DC78"/>
            <stop offset="48%"  stopColor="#C8961E"/>
            <stop offset="100%" stopColor="#7A5808"/>
          </radialGradient>

          {/* ── Hair ── */}
          <linearGradient id="vHair" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1C2468"/>
            <stop offset="100%" stopColor="#06080E"/>
          </linearGradient>

          {/* ── Boot ── */}
          <linearGradient id="vBoot" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%"   stopColor="#281570"/>
            <stop offset="100%" stopColor="#0C0628"/>
          </linearGradient>

          {/* ── ZK Orb ── */}
          <radialGradient id="vOrb" cx="38%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#EDE0FF"/>
            <stop offset="38%"  stopColor="#9B7CF0"/>
            <stop offset="100%" stopColor="#1E0E48" stopOpacity="0.85"/>
          </radialGradient>
          <radialGradient id="vOrbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#7B5CF0" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#7B5CF0" stopOpacity="0"/>
          </radialGradient>

          {/* ── Filters ── */}
          <filter id="fOrbGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="fBadge" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="fTrace" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="fCapeEdge" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ═══════════════════════════════════════
            LAYER 1 — BACKGROUND HEX CIRCUIT FIELD
            ═══════════════════════════════════════ */}
        <g opacity="0.07" stroke="#7B5CF0" strokeWidth="0.8" fill="none">
          <path d="M185 155 L200 146 L215 155 L215 173 L200 182 L185 173 Z"/>
          <path d="M215 155 L230 146 L245 155 L245 173 L230 182 L215 173 Z"/>
          <path d="M155 155 L170 146 L185 155 L185 173 L170 182 L155 173 Z"/>
          <path d="M200 182 L215 173 L230 182 L230 200 L215 209 L200 200 Z"/>
          <path d="M170 182 L185 173 L200 182 L200 200 L185 209 L170 200 Z"/>
          <path d="M215 209 L230 200 L245 209 L245 227 L230 236 L215 227 Z"/>
        </g>

        {/* ═════════════════
            LAYER 2 — SPEED LINES
            ═════════════════ */}
        <g opacity="0.09" stroke="white" strokeLinecap="round">
          <line x1="0" y1="82"  x2="52" y2="94"  strokeWidth="2.5"/>
          <line x1="0" y1="110" x2="46" y2="116" strokeWidth="2"/>
          <line x1="0" y1="138" x2="48" y2="140" strokeWidth="1.5"/>
          <line x1="0" y1="162" x2="44" y2="160" strokeWidth="1.2"/>
          <line x1="0" y1="185" x2="38" y2="180" strokeWidth="0.9"/>
        </g>

        {/* ═══════════════
            LAYER 3 — CAPE
            ═══════════════ */}
        {/* Cape exterior — back face, large dramatic sweep */}
        <path
          d="M 82 168
             C 115 130 200 88 310 60
             C 390 42 430 100 415 170
             C 398 240 340 292 268 318
             C 210 338 152 330 118 308
             C 92 290 84 248 82 168 Z"
          fill="url(#vCapeExt)"
        />
        {/* Cape interior lining — catches light on the inside billowing face */}
        <path
          d="M 120 305
             C 158 330 215 338 272 316
             C 344 290 402 238 415 168
             C 390 100 330 68 250 88
             C 185 105 145 145 128 185
             C 118 220 118 270 120 305 Z"
          fill="url(#vCapeInt)"
          opacity="0.65"
        />
        {/* Cape inner fold shadow */}
        <path
          d="M 128 185 C 155 168 210 138 268 118 C 320 100 370 92 410 98"
          stroke="rgba(0,0,0,0.22)" strokeWidth="4" fill="none" strokeLinecap="round"
        />
        {/* Cape leading edge — violet glow on trailing hem */}
        <path
          d="M 415 168 C 400 238 342 290 270 316"
          stroke="#7B5CF0" strokeWidth="1.8" fill="none" opacity="0.3"
          filter="url(#fCapeEdge)" strokeLinecap="round"
        />
        {/* Cape collar attachment band */}
        <path
          d="M 82 168 C 88 155 98 148 115 148 L 178 148 C 192 148 200 155 200 165"
          stroke="#2C1C6B" strokeWidth="4" fill="none" strokeLinecap="round"
        />

        {/* ══════════════════════════
            LAYER 4 — TRAIL ARM & HAND
            ══════════════════════════ */}
        <path
          d="M 65 192
             C 44 208 22 232 12 252
             C 18 260 28 258 38 250
             C 52 232 68 210 75 200 Z"
          fill="url(#vSkinLimb)"
        />
        {/* Trail glove */}
        <path
          d="M 8 248
             C 4 256 6 268 14 272
             C 22 276 32 270 34 260
             C 36 250 28 242 16 242 Z"
          fill="#1A0E3D"
        />
        {/* Glove circuit detail */}
        <path d="M 14 250 Q 22 246 30 252" stroke="#4C35A8" strokeWidth="0.8" fill="none" opacity="0.6"/>

        {/* ═══════════
            LAYER 5 — LEGS
            ═══════════ */}
        {/* Trail leg */}
        <path
          d="M 85 302
             C 72 358 54 412 42 462
             C 52 468 64 466 70 460
             C 80 412 98 358 108 304 Z"
          fill="url(#vSuitLeg)"
        />
        {/* Leg center shadow */}
        <path d="M 88 304 C 85 358 78 412 72 462" stroke="rgba(0,0,0,0.2)" strokeWidth="2" fill="none"/>
        {/* Lead leg */}
        <path
          d="M 170 296
             C 190 352 218 408 236 462
             C 246 468 258 466 264 460
             C 244 406 216 350 196 294 Z"
          fill="url(#vSuitLeg)"
        />

        {/* Trail boot */}
        <path
          d="M 40 460
             C 34 474 36 488 44 496
             C 54 502 66 498 70 488
             C 74 478 68 464 58 460 Z"
          fill="url(#vBoot)"
        />
        <path d="M 42 472 C 46 482 52 492 58 496" stroke="rgba(255,255,255,0.11)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M 38 474 C 44 466 58 462 68 466" stroke="#C4912A" strokeWidth="0.9" fill="none" opacity="0.65"/>

        {/* Lead boot */}
        <path
          d="M 234 460
             C 228 474 230 488 240 496
             C 250 502 264 498 268 488
             C 270 478 264 464 252 460 Z"
          fill="url(#vBoot)"
        />
        <path d="M 236 472 C 240 482 246 492 252 496" stroke="rgba(255,255,255,0.11)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M 232 474 C 238 466 252 462 266 466" stroke="#C4912A" strokeWidth="0.9" fill="none" opacity="0.65"/>

        {/* ══════════════
            LAYER 6 — TORSO
            ══════════════ */}
        <path
          d="M 68 194
             C 92 180 148 172 198 174
             C 210 180 212 200 208 302
             C 185 316 118 316 80 308
             C 64 296 62 252 68 194 Z"
          fill="url(#vSuit)"
        />
        {/* Torso shadow — trail side */}
        <path
          d="M 68 194 C 68 240 66 282 72 308 C 78 316 80 308 78 295 C 70 260 68 220 68 194 Z"
          fill="rgba(0,0,0,0.18)"
        />
        {/* Torso highlight — lead side */}
        <path
          d="M 195 178 C 208 185 210 220 205 295 C 198 316 190 318 190 305 C 198 260 200 215 195 178 Z"
          fill="rgba(255,255,255,0.04)"
        />
        {/* Costume center seam */}
        <line x1="135" y1="178" x2="138" y2="308" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5"/>
        {/* Hex mesh texture on torso */}
        <g stroke="rgba(123,92,240,0.14)" strokeWidth="0.9" fill="rgba(123,92,240,0.04)">
          <path d="M 110 198 L 124 190 L 138 198 L 138 213 L 124 221 L 110 213 Z"/>
          <path d="M 138 198 L 152 190 L 166 198 L 166 213 L 152 221 L 138 213 Z"/>
          <path d="M 124 221 L 138 213 L 152 221 L 152 236 L 138 244 L 124 236 Z"/>
          <path d="M 96  221 L 110 213 L 124 221 L 124 236 L 110 244 L 96  236 Z"/>
          <path d="M 110 244 L 124 236 L 138 244 L 138 259 L 124 267 L 110 259 Z"/>
        </g>

        {/* ══════════════════
            LAYER 7 — BELT
            ══════════════════ */}
        <rect x="72" y="292" width="130" height="15" rx="5" fill="#0E0728"/>
        <rect x="72" y="290" width="130" height="5"  rx="2" fill="rgba(255,255,255,0.07)"/>
        {/* Hexagonal belt clasp */}
        <path d="M 124 288 L 138 280 L 152 288 L 152 304 L 138 312 L 124 304 Z" fill="#1C1048"/>
        <path d="M 128 290 L 138 284 L 148 290 L 148 302 L 138 308 L 128 302 Z" fill="url(#vGold)" filter="url(#fBadge)"/>
        {/* KYA micro-text on clasp */}
        <text x="130" y="300" fontSize="5.5" fontWeight="800" fill="#1A0E3D" fontFamily="monospace" letterSpacing="0.8">KYA</text>

        {/* ═══════════
            LAYER 8 — NECK
            ═══════════ */}
        <path d="M 112 158 C 120 152 148 150 162 154 L 165 175 C 148 180 118 180 110 176 Z" fill="#C47850"/>
        {/* Collar */}
        <path d="M 108 176 C 115 168 148 165 168 170 L 168 178 C 148 174 115 174 108 178 Z" fill="#1A0E3D"/>

        {/* ══════════════
            LAYER 9 — HAIR
            ══════════════ */}
        {/* Main hair mass — flowing behind/left */}
        <path
          d="M 100 75
             C 118 54 155 52 188 58
             C 218 48 265 58 298 72
             C 270 88 232 94 200 97
             C 168 100 138 100 108 108
             C 88 108 75 100 72 90
             C 76 80 90 74 100 75 Z"
          fill="url(#vHair)"
        />
        {/* Hair trailing behind (to the left — she flies right) */}
        <path d="M 80 90 C 52 82 24 92 8 106" stroke="#080C18" strokeWidth="10" fill="none" strokeLinecap="round"/>
        <path d="M 84 98 C 58 96 32 110 14 122" stroke="#080C18" strokeWidth="7"  fill="none" strokeLinecap="round"/>
        <path d="M 86 107 C 62 110 38 124 22 136" stroke="#080C18" strokeWidth="5"  fill="none" strokeLinecap="round"/>
        <path d="M 88 114 C 66 120 44 132 30 144" stroke="#080C18" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        {/* Hair highlight shimmer */}
        <path d="M 115 58 C 158 48 210 50 255 62" stroke="#1E2C80" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75"/>
        <path d="M 122 58 C 162 50 212 52 248 64" stroke="#2A3898" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.45"/>

        {/* ══════════════
            LAYER 10 — HEAD
            ══════════════ */}
        <ellipse cx="148" cy="112" rx="50" ry="54" fill="url(#vSkinFace)"/>
        {/* Jaw shadow */}
        <path
          d="M 102 128 C 100 144 108 158 120 162 C 130 165 145 165 160 160 C 172 155 180 144 178 130"
          stroke="rgba(0,0,0,0.1)" strokeWidth="6" fill="none"
        />
        {/* Ear */}
        <ellipse cx="96" cy="112" rx="8" ry="13" fill="#C07848"/>
        <ellipse cx="96" cy="112" rx="4.5" ry="8" fill="#B06840" opacity="0.5"/>
        {/* Ear lobe detail */}
        <ellipse cx="97" cy="122" rx="3" ry="3.5" fill="#A85C38" opacity="0.4"/>

        {/* ════════════════════════
            LAYER 11 — MASK / VISOR
            ════════════════════════ */}
        <path
          d="M 102 106
             C 118 94 142 90 162 94
             C 180 90 198 96 206 108
             C 198 126 175 130 152 126
             C 128 130 106 124 102 106 Z"
          fill="#0E0830"
        />
        {/* Visor lens fill */}
        <path
          d="M 106 106 C 120 96 142 93 162 97 C 178 93 194 100 200 110 C 194 124 174 128 152 124 C 128 128 110 120 106 106 Z"
          fill="#14083C"
        />
        {/* Visor left lens highlight */}
        <path
          d="M 108 103 C 118 96 135 94 148 98 C 136 108 115 110 108 106 Z"
          fill="rgba(255,255,255,0.11)"
        />
        {/* Visor right lens highlight */}
        <path
          d="M 162 96 C 174 94 190 98 198 107 C 190 115 178 118 165 116 C 170 108 168 100 162 96 Z"
          fill="rgba(255,255,255,0.07)"
        />
        {/* Visor electric glow line */}
        <path
          d="M 108 112 C 128 104 148 108 162 108 C 178 108 194 112 198 116"
          stroke="#818CF8" strokeWidth="1" fill="none" opacity="0.55" strokeLinecap="round"
        />
        {/* Visor corner nodes */}
        <circle cx="106" cy="108" r="2"   fill="#7B5CF0" opacity="0.8"/>
        <circle cx="200" cy="110" r="2"   fill="#7B5CF0" opacity="0.8"/>
        <circle cx="152" cy="127" r="1.5" fill="#9B7CF0" opacity="0.6"/>

        {/* ═══════════════════
            FACE FEATURES
            ═══════════════════ */}
        {/* Nose */}
        <path d="M 142 126 C 140 134 144 140 150 142" stroke="#B0683A" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
        {/* Lips */}
        <path d="M 132 148 C 142 155 158 155 168 148" stroke="#C86050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M 140 148 C 148 152 156 152 164 148" stroke="#E08070" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5"/>
        {/* Cheekbone highlight */}
        <ellipse cx="182" cy="118" rx="9" ry="6" fill="rgba(255,190,150,0.13)" transform="rotate(-12 182 118)"/>
        <ellipse cx="112" cy="122" rx="7" ry="5" fill="rgba(255,190,150,0.10)" transform="rotate(8 112 122)"/>

        {/* ════════════════════════════════════════
            LAYER 12 — LEAD ARM (extends right toward orb)
            ════════════════════════════════════════ */}
        {/* Upper arm / bicep */}
        <path
          d="M 185 180
             C 232 165 292 158 350 155
             C 354 170 308 184 262 192
             C 225 198 188 200 185 198 Z"
          fill="url(#vSkinLimb)"
        />
        {/* Forearm slight foreshortening */}
        <path
          d="M 285 158
             C 318 152 355 152 378 162
             C 382 178 356 188 322 188
             C 296 188 282 180 282 170 Z"
          fill="url(#vSuitArm)"
        />
        {/* Lead glove */}
        <path
          d="M 354 152
             C 375 148 402 152 412 164
             C 414 178 398 188 376 188
             C 356 188 346 178 346 166 Z"
          fill="#1A0E3D"
        />
        {/* Glove circuit traces */}
        <path d="M 358 160 L 378 156 L 398 162 L 394 172" stroke="#7B5CF0" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.75" filter="url(#fTrace)"/>
        <path d="M 362 174 L 384 170 L 400 176"           stroke="#7B5CF0" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.55" filter="url(#fTrace)"/>
        <path d="M 356 168 L 360 164"                     stroke="#9B7CF0" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.6"/>
        {/* Circuit nodes on glove */}
        <circle cx="398" cy="162" r="2.2" fill="#7B5CF0" opacity="0.85" filter="url(#fTrace)"/>
        <circle cx="362" cy="174" r="1.8" fill="#A88CF0" opacity="0.7"/>
        {/* Glove gold cuff trim */}
        <path d="M 348 165 C 352 158 362 154 374 154" stroke="#C4912A" strokeWidth="1.1" fill="none" opacity="0.7" strokeLinecap="round"/>
        {/* Exposed fist skin */}
        <ellipse cx="408" cy="170" rx="12" ry="10" fill="#C47850"/>
        {/* Knuckle lines */}
        <path d="M 398 166 Q 402 163 408 165" stroke="#A06040" strokeWidth="1" fill="none" opacity="0.45"/>
        <path d="M 397 173 Q 401 170 408 172" stroke="#A06040" strokeWidth="0.9" fill="none" opacity="0.38"/>

        {/* ═══════════════════════════════════
            LAYER 13 — CHEST BADGE (hex ZK shield)
            ═══════════════════════════════════ */}
        <g filter="url(#fBadge)">
          {/* Outer hex */}
          <path
            d="M 122 200 L 138 190 L 154 200 L 154 224 L 138 234 L 122 224 Z"
            fill="url(#vGold)"
          />
          {/* Inner hex border */}
          <path
            d="M 126 202 L 138 194 L 150 202 L 150 222 L 138 230 L 126 222 Z"
            fill="none" stroke="#F0DC80" strokeWidth="0.6" opacity="0.55"
          />
          {/* ZK lettermark */}
          <text
            x="124" y="220"
            fontSize="12" fontWeight="900" fill="#0E0830"
            fontFamily="'Courier New', monospace" letterSpacing="-0.5"
          >ZK</text>
        </g>

        {/* ═══════════════════════════
            LAYER 14 — ZK ORB
            ═══════════════════════════ */}
        {/* Outer glow rings */}
        <circle cx="380" cy="142" r="58" fill="url(#vOrbGlow)" opacity="0.5" className="zkx-orb-pulse"/>
        <circle cx="380" cy="142" r="40" fill="url(#vOrbGlow)" opacity="0.4" className="zkx-orb-pulse"/>
        {/* Orb shell */}
        <circle cx="380" cy="142" r="26" fill="url(#vOrb)" filter="url(#fOrbGlow)" className="zkx-orb-pulse"/>
        {/* Orbital verification rings */}
        <ellipse cx="380" cy="142" rx="36" ry="12" stroke="#7B5CF0" strokeWidth="1.1" fill="none" opacity="0.5"  transform="rotate(-25 380 142)"/>
        <ellipse cx="380" cy="142" rx="36" ry="12" stroke="#9B8CF0" strokeWidth="0.7" fill="none" opacity="0.32" transform="rotate(50 380 142)"/>
        {/* Orb highlight */}
        <circle cx="371" cy="134" r="7" fill="rgba(255,255,255,0.3)"/>
        <circle cx="373" cy="133" r="3.5" fill="rgba(255,255,255,0.5)"/>
        {/* Orb core — the proof kernel */}
        <circle cx="380" cy="142" r="6" fill="#EDE0FF" opacity="0.95" filter="url(#fTrace)"/>
        <circle cx="380" cy="142" r="2.5" fill="white"/>

        {/* Orb energy particles */}
        <circle cx="408" cy="122" r="3.5" fill="#818CF8" opacity="0.72" className="zkx-orb-pulse"/>
        <circle cx="416" cy="142" r="2.2" fill="#60A5FA" opacity="0.58"/>
        <circle cx="408" cy="162" r="3"   fill="#A78BFA" opacity="0.65" className="zkx-orb-pulse"/>
        <circle cx="418" cy="130" r="1.8" fill="#EDE0FF" opacity="0.5"/>
        <circle cx="350" cy="120" r="2.2" fill="#C4B5FD" opacity="0.55"/>
        <circle cx="348" cy="160" r="1.5" fill="#818CF8" opacity="0.45"/>
        <circle cx="358" cy="116" r="1.2" fill="white"   opacity="0.4"/>

        {/* ════════════════════════════════════════════
            LAYER 15 — PROOF PATH TRACES (glove → orb)
            ════════════════════════════════════════════ */}
        <g filter="url(#fTrace)" className="proof-trace">
          <path
            d="M 420 162 C 430 155 432 145 418 138"
            stroke="#818CF8" strokeWidth="1.4" fill="none"
            strokeDasharray="5 3.5" opacity="0.72" strokeLinecap="round"
          />
          <path
            d="M 420 170 C 432 168 438 158 422 148"
            stroke="#7B5CF0" strokeWidth="1.1" fill="none"
            strokeDasharray="4 3" opacity="0.55" strokeLinecap="round"
          />
          <path
            d="M 418 178 C 432 178 440 166 424 154"
            stroke="#A88CF0" strokeWidth="0.85" fill="none"
            strokeDasharray="3 3" opacity="0.42" strokeLinecap="round"
          />
        </g>

        {/* Proof node at fist tip */}
        <circle cx="418" cy="170" r="4" fill="#7B5CF0" opacity="0.85" filter="url(#fTrace)"/>
        <circle cx="418" cy="170" r="1.8" fill="#EDE0FF"/>
      </svg>
    </div>
  );
}
