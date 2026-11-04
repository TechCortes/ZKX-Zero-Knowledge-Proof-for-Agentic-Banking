import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import AssistantChat from "@/components/AssistantChat";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

const title = "ZQUENT — Zero-Knowledge, Post-Quantum Trust Protocol for Agentic Banking and Micropayments";
const description =
  "ZQUENT is open-source Know Your Agent (KYA) compliance for AI agent payments. Agents prove eligibility — not identity — with zero-knowledge proofs, and escrowed identity data is sealed with post-quantum cryptography. MIT licensed. FATF R.16 aligned. Built on the Open Wallet Standard.";

export const metadata: Metadata = {
  metadataBase: new URL("https://zkx-psi.vercel.app"),
  title,
  description,
  applicationName: "ZQUENT",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ZQUENT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111A2B" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT sets data-theme on <html> before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="bg-zq-bg text-zq-text font-sans">
        {children}
        <AssistantChat />
      </body>
    </html>
  );
}
