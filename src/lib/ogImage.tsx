import { ImageResponse } from "next/og";

/** Shared 1200×630 social card, rendered to PNG at build time by next/og. */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          color: "white",
          backgroundColor: "#04040a",
          backgroundImage:
            "radial-gradient(circle at 88% 8%, rgba(109,40,217,0.38) 0%, rgba(4,4,10,0) 52%), radial-gradient(circle at 6% 96%, rgba(37,99,235,0.28) 0%, rgba(4,4,10,0) 48%)",
        }}
      >
        {/* Mark + eyebrow */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="76" height="76" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="6" fill="url(#g)" />
            <path
              d="M16 4 L28 16 L16 28 L4 16 Z"
              stroke="white"
              strokeWidth="2"
              strokeOpacity="0.5"
              fill="white"
              fillOpacity="0.09"
            />
            <path d="M16 10.5 L21.5 16 L16 21.5 L10.5 16 Z" fill="white" fillOpacity="0.93" />
          </svg>
          <div
            style={{
              display: "flex",
              marginLeft: 28,
              fontSize: 26,
              letterSpacing: 6,
              color: "#64748b",
              textTransform: "uppercase",
            }}
          >
            Agent Compliance
          </div>
        </div>

        {/* Name + value prop */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 132, lineHeight: 1, letterSpacing: -4 }}>
            <span>Vero</span>
            <span style={{ color: "#94a3b8", marginLeft: 32 }}>Protocol</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              fontSize: 44,
              lineHeight: 1.25,
              color: "#e2e8f0",
              maxWidth: 1032,
            }}
          >
            Zero-Knowledge Compliance for AI Agent Wallets
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 32, color: "#a78bfa" }}>
            Agents prove eligibility — not identity.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", fontSize: 26, color: "#64748b" }}>
          Open source · MIT licensed · Built on the Open Wallet Standard
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
