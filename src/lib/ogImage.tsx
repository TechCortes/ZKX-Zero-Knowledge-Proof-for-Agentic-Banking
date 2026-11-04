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
          padding: "64px 80px",
          color: "#EDEEF0",
          backgroundColor: "#0A0B0D",
          border: "1px solid #1F2329",
        }}
      >
        {/* Mark + eyebrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="4" fill="#0A0B0D" />
              <rect x="0.5" y="0.5" width="31" height="31" rx="3.5" stroke="#3DDC97" />
              <path d="M10 10h12L10 22h12" stroke="#EDEEF0" strokeWidth="2.4" strokeLinecap="square" />
            </svg>
            <div style={{ display: "flex", marginLeft: 24, fontSize: 34, letterSpacing: 8, fontWeight: 600 }}>
              ZQUENT
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#3DDC97", textTransform: "uppercase" }}>
            Testnet · MIT
          </div>
        </div>

        {/* Headline + descriptor */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, lineHeight: 1.04, letterSpacing: -3, fontWeight: 600 }}>
            Every agent payment, proven.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, lineHeight: 1.3, color: "#B6BBC3", maxWidth: 1000 }}>
            The zero-knowledge, post-quantum trust protocol for agentic banking and micropayments.
          </div>
        </div>

        {/* Footer rule + facts */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #2C313A",
            paddingTop: 24,
            fontSize: 22,
            letterSpacing: 3,
            color: "#8A9099",
            textTransform: "uppercase",
          }}
        >
          <span>Know Your Agent</span>
          <span>Zero PII</span>
          <span>ML-KEM-768 escrow</span>
          <span>Open Wallet Standard</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
