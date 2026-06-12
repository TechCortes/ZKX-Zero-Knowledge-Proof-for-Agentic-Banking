import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKX — Zero-Knowledge Agentic Banking",
  description:
    "Know Your Agent (KYA) — zero-knowledge compliance infrastructure for AI agents in financial markets. Compliant by default. Private by design.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
