/**
 * Shared bits for the disclosure API routes.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getDisclosureRegistry } from "./config";
import { disclosureReadiness, type ConsortiumRegistry } from "./keyRegistry";
import { tallyApprovals, type Approval } from "./requests";
import { getApprovals, getDisclosureRequest, type StoredDisclosureRequest } from "./store";

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

/**
 * D5 routes only work on an approved, unexpired request. Returns the record and
 * its approvals, or the response to send: 422 bad hash, 404 unknown, 409 not
 * approved yet, 410 expired. `allowExpired` lets the regulator collect
 * deliveries that arrived before expiry.
 */
export async function loadApprovedRequest(
  reg: ConsortiumRegistry,
  requestHash: string,
  opts: { allowExpired?: boolean } = {}
): Promise<{ rec: StoredDisclosureRequest; approvals: Approval[] } | NextResponse> {
  if (!REQUEST_HASH_RE.test(requestHash)) {
    return NextResponse.json({ error: "requestHash must be 64 lowercase hex characters." }, { status: 422 });
  }
  const rec = await getDisclosureRequest(requestHash);
  if (!rec) return NextResponse.json({ error: "No such request." }, { status: 404 });
  if (!opts.allowExpired && rec.request.expiresAt <= new Date().toISOString()) {
    return NextResponse.json({ error: "This request has expired." }, { status: 410 });
  }
  const approvals = await getApprovals(requestHash);
  if (!tallyApprovals(reg, requestHash, rec.request.expiresAt, approvals).approved) {
    return NextResponse.json({ error: "This request is not approved yet." }, { status: 409 });
  }
  return { rec, approvals };
}
