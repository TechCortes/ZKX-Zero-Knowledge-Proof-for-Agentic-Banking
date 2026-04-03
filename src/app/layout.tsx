import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKX — ZK-KYC for Agents",
  description:
    "Composable compliance without doxxing. Extends the Open Wallet Standard with zero-knowledge identity proofs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
