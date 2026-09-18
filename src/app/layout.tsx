import type { Metadata } from "next";
import "./globals.css";

const title = "Vero Protocol — Zero-Knowledge Compliance for AI Agent Wallets";
const description =
  "Vero is open-source zero-knowledge compliance for AI agent payments. Agents prove eligibility — not identity. MIT licensed. FATF R.15/R.16 aligned. Built on the Open Wallet Standard. Fork it on GitHub.";

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
