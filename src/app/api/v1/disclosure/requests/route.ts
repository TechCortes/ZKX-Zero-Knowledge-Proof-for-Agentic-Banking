import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRevealEscrow } from "@/policy/escrow";
import { loadRegistry, readJsonBody } from "@/disclosure/http";
import { checkSignedRequest, computeRequestHash, type SignedDisclosureRequest } from "@/disclosure/requests";
import {
  createDisclosureRequest,
  getDisclosureRequest,
  listRequestHashes,
  publicSummary,
  takeRateSlot,
} from "@/disclosure/store";

const ROUTE = "/api/v1/disclosure/requests";

/**
 * POST: a registered regulator asks for one transaction to be unmasked.
 * Body is `{ request, signature }` (vero-disclosure-request/v1, see
 * docs/disclosure-requests.md). The signature is the authentication: there
 * is no API key. Returns the requestHash the approvers must sign.
 *
 * Errors: 401 bad signature, 403 unknown/inactive regulator, 404 no escrowed
 * identity for txId, 409 replay, 422 malformed, 429 over the daily limit,
 * 503 disclosure off.
 */
export async function POST(req: NextRequest) {
  const reg = loadRegistry(`POST ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;

  const body = await readJsonBody(req);
  const check = checkSignedRequest(reg, body);
  if (!check.ok) {
    logger.warn(`POST ${ROUTE}`, "rejected", { status: check.status, error: check.error });
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const signed = body as SignedDisclosureRequest;
  const { request } = signed;

  // Counted after the signature check, so nobody else can use up a regulator's quota,
  // and before the escrow lookup, so the limit also caps probing for txIds.
  if (!(await takeRateSlot(request.regulatorId))) {
    logger.warn(`POST ${ROUTE}`, "rate_limited", { regulatorId: request.regulatorId });
    return NextResponse.json({ error: "Daily disclosure request limit reached for this regulator." }, { status: 429 });
  }

  const escrow = await getRevealEscrow(request.txId);
  if (!escrow) return NextResponse.json({ error: "No escrowed identity for this transaction." }, { status: 404 });

  const requestHash = computeRequestHash(request, escrow.ciphertextHash);
  const created = await createDisclosureRequest({
    requestHash,
    request,
    regulatorSignature: signed.signature,
    ciphertextHash: escrow.ciphertextHash,
    receivedAt: new Date().toISOString(),
  });
  if (!created) return NextResponse.json({ error: "This request was already submitted.", requestHash }, { status: 409 });

  logger.info(`POST ${ROUTE}`, "created", { requestHash, regulatorId: request.regulatorId });
  const rec = (await getDisclosureRequest(requestHash))!;
  return NextResponse.json(
    {
      ...(await publicSummary(reg, rec)),
      // Only the regulator gets this: it forwards it with the request so approvers can recompute requestHash.
      ciphertextHash: escrow.ciphertextHash,
    },
    { status: 201 }
  );
}

/**
 * GET: the public log. Hash-only summaries, newest first; never txIds.
 * `?limit=` (1..100, default 20).
 */
export async function GET(req: NextRequest) {
  const reg = loadRegistry(`GET ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam === null ? 20 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "limit must be an integer from 1 to 100." }, { status: 422 });
  }
  const hashes = await listRequestHashes(limit);
  const records = await Promise.all(hashes.map(getDisclosureRequest));
  const requests = await Promise.all(records.filter((r) => r !== null).map((r) => publicSummary(reg, r)));
  return NextResponse.json({ consortiumId: reg.consortiumId, approvalThreshold: reg.approvalThreshold, requests });
}
