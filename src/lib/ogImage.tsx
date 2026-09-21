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
            <rect width="32" height="32" rx="6" fill="#3730A3" />
            <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="white" />
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
