/**
 * Shared bits for the disclosure API routes.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getDisclosureRegistry } from "./config";
import { disclosureReadiness, type ConsortiumRegistry } from "./keyRegistry";

export const REQUEST_HASH_RE = /^[0-9a-f]{64}$/;

/**
 * The registry, or the response to send instead: 503 when disclosure is off,
 * not ready (too few approvers, no regulator) or misconfigured.
 */
export function loadRegistry(route: string): ConsortiumRegistry | NextResponse {
  let reg: ConsortiumRegistry | null;
  try {
    reg = getDisclosureRegistry();
  } catch (err) {
    logger.error(route, "registry_misconfigured", { error: String(err) });
    return NextResponse.json({ error: "The disclosure registry is misconfigured." }, { status: 500 });
  }
  if (!reg) return NextResponse.json({ error: "Disclosure requests are not enabled on this deployment." }, { status: 503 });
  const problems = disclosureReadiness(reg);
  if (problems.length) {
    logger.warn(route, "registry_not_ready", { problems });
    return NextResponse.json({ error: "Disclosure is not ready.", problems }, { status: 503 });
  }
  return reg;
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
