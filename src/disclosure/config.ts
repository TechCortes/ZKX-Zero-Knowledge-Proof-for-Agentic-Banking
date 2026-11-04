/**
 * Server-side disclosure config.
 *
 * The registry is a public file (default `config/vero-registry.json`,
 * override with VERO_REGISTRY_FILE). Disclosure is on only when that file
 * exists. When it does, VERO_REGISTRY_MEMBERS_ID must pin its member set:
 * an unpinned registry would let whoever can change the file choose the
 * consortium. A present-but-invalid or unpinned registry throws instead of
 * quietly turning disclosure off, the same rule as revealConfig.ts.
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { parseRegistry, type ConsortiumRegistry } from "./keyRegistry";
import { getEscrowKeySet } from "@/zkp/revealConfig";

export const DEFAULT_REGISTRY_FILE = "config/vero-registry.json";

let cached: { key: string; registry: ConsortiumRegistry } | null = null;

/** The verified registry, or null when disclosure is off. Throws when misconfigured. */
export function getDisclosureRegistry(): ConsortiumRegistry | null {
  // Shipped via outputFileTracingIncludes in next.config.ts; tell the tracer not to follow this path.
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.VERO_REGISTRY_FILE?.trim() || DEFAULT_REGISTRY_FILE);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  const pin = process.env.VERO_REGISTRY_MEMBERS_ID?.trim();
  if (!pin) throw new Error("A disclosure registry is present but VERO_REGISTRY_MEMBERS_ID is not set. Pin the member set.");
  const escrowKeys = getEscrowKeySet();
  const key = createHash("sha256").update(raw).update(`|${pin}|${escrowKeys ? JSON.stringify(escrowKeys) : ""}`).digest("hex");
  if (cached?.key === key) return cached.registry;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${file} is not valid JSON.`);
  }
  const registry = parseRegistry(parsed, { pinnedMembersId: pin, ...(escrowKeys ? { escrowKeys } : {}) });
  cached = { key, registry };
  return registry;
}
