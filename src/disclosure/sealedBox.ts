/**
 * Sealed box (`vero-sealed-box/v1`): encrypt a message to one party's X-Wing
 * (ML-KEM-768 + X25519) public key.
 *
 *   (kem, ss) = X-Wing.Encaps(recipient public key)
 *   key       = HKDF-SHA256(ss, info = "vero-sealed-box/v1|" ‖ context)
 *   data      = AES-256-GCM(key, message, AAD = context)
 *
 * `context` names what the box is for (request, sender, recipient). The box
 * opens only with the same context, so it can't be moved to another request
 * or recipient. Used by the disclosure flow to pass escrow share parts between
 * members and to deliver the result to the regulator.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { ml_kem768_x25519 as xwing } from "@noble/post-quantum/hybrid.js";

export const SEALED_BOX_FORMAT = "vero-sealed-box/v1";

export interface SealedBox {
  format: typeof SEALED_BOX_FORMAT;
  kem: string;  // base64 X-Wing ciphertext
  iv: string;   // base64, 12 bytes
  data: string; // base64, ciphertext ‖ 16-byte GCM tag
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

function boxKey(sharedSecret: Uint8Array, context: string): Buffer {
  return Buffer.from(hkdfSync("sha256", sharedSecret, new Uint8Array(0), `${SEALED_BOX_FORMAT}|${context}`, 32));
}

export function sealTo(recipientPublicKey: string, message: Uint8Array, context: string): SealedBox {
  const { cipherText, sharedSecret } = xwing.encapsulate(unb64(recipientPublicKey));
  const key = boxKey(sharedSecret, context);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(message), cipher.final(), cipher.getAuthTag()]);
  key.fill(0);
  return { format: SEALED_BOX_FORMAT, kem: b64(cipherText), iv: b64(iv), data: b64(data) };
}

/** Throws if the key, the context or the box is wrong. */
export function openBox(recipientSecretKey: string, box: SealedBox, context: string): Buffer {
  if (!isSealedBox(box)) throw new Error("Not a sealed box.");
  try {
    const key = boxKey(xwing.decapsulate(unb64(box.kem), unb64(recipientSecretKey)), context);
    const raw = Buffer.from(box.data, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    return Buffer.concat([decipher.update(raw.subarray(0, raw.length - 16)), decipher.final()]);
  } catch {
    throw new Error("Sealed box did not open. Wrong key, or it was made for something else.");
  }
}

export function isSealedBox(x: unknown): x is SealedBox {
  const b = x as Partial<SealedBox> | null;
  return Boolean(b) && typeof b === "object" && b!.format === SEALED_BOX_FORMAT &&
    typeof b!.kem === "string" && typeof b!.iv === "string" && typeof b!.data === "string" &&
    b!.kem.length < 4096 && b!.iv.length < 64 && b!.data.length < 65536;
}
