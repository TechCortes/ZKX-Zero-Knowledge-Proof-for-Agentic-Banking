import { ImageResponse } from "next/og";

const Z_PATH = "M9 8.5H23V11.5L13.2 20.5H23V23.5H9V20.5L18.8 11.5H9Z";

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
          color: "#0B1F3A",
          backgroundColor: "#F5F7FA",
        }}
      >
        {/* Mark + status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="72" height="72" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#0B1F3A" />
              <path d={Z_PATH} fill="#FFFFFF" />
            </svg>
            <div style={{ display: "flex", marginLeft: 24, fontSize: 36, letterSpacing: 6, fontWeight: 600 }}>ZQUENT</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid #C3CCD8",
              backgroundColor: "#FFFFFF",
              fontSize: 22,
              color: "#4A5668",
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, backgroundColor: "#0E8A5F", marginRight: 12 }} />
            Live on testnet · Open source
          </div>
        </div>

        {/* Headline + descriptor */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 88, lineHeight: 1.05, letterSpacing: -3, fontWeight: 600 }}>
            <span>Every agent payment,</span>
            <span style={{ color: "#1F4FD8" }}>proven.</span>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, lineHeight: 1.35, color: "#4A5668", maxWidth: 1000 }}>
            The zero-knowledge, post-quantum trust protocol for agentic banking and micropayments.
          </div>
        </div>

        {/* Facts */}
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#33415A" }}>
          {["No personal data collected", "FATF R.16 threshold", "Post-quantum escrow"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderRadius: 12, border: "1px solid #D9DFE8", backgroundColor: "#FFFFFF" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}><path d="M5 13l4 4L19 7" stroke="#0E8A5F" strokeWidth="3" strokeLinecap="square" /></svg>{t}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
