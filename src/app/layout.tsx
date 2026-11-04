import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import AssistantChat from "@/components/AssistantChat";

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
  themeColor: "#0A0B0D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-zq-bg text-zq-text font-sans">
        {children}
        <AssistantChat />
      </body>
    </html>
  );
}
