import { renderOgImage } from "@/lib/ogImage";

export const alt = "ZQUENT — Zero-Knowledge, Post-Quantum Trust Protocol for Agentic Banking and Micropayments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage();
}
