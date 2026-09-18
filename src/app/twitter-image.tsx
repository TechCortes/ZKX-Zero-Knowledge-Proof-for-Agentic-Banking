import { renderOgImage } from "@/lib/ogImage";

export const alt = "Vero Protocol — Zero-Knowledge Compliance for AI Agent Wallets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage();
}
