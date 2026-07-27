import type { Metadata } from "next";
import "./globals.css";

const title = "ZKX — Zero-Knowledge Agentic Banking";
const description =
  "Know Your Agent (KYA) — zero-knowledge compliance infrastructure for AI agents in financial markets. Open source, MIT licensed. Compliant by default. Private by design.";

export const metadata: Metadata = {
  metadataBase: new URL("https://zkx-psi.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    type: "website",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/logo.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
