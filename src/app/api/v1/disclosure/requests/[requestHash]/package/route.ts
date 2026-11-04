import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRevealEscrow } from "@/policy/escrow";
import { loadApprovedRequest, loadRegistry } from "@/disclosure/http";
import { checkAccess, type DisclosurePackage } from "@/disclosure/delivery";

const ROUTE = "GET /api/v1/disclosure/requests/:requestHash/package";

/**
 * Consortium members only (Authorization: ZQ-Sig, party "member", action
 * "package"). Everything a member needs to check an approved request and
 * release its share: the signed request, the approvals and the sealed escrow
 * envelope. Members re-check all of it; see verifyPackage.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ requestHash: string }> }) {
  const reg = loadRegistry(ROUTE);
  if (reg instanceof NextResponse) return reg;
  const { requestHash } = await params;
  const loaded = await loadApprovedRequest(reg, requestHash);
  if (loaded instanceof NextResponse) return loaded;
  const { rec, approvals } = loaded;

  const access = checkAccess(reg, req.headers.get("authorization"), {
    requestHash, action: "package", party: "member", regulatorId: rec.request.regulatorId,
  });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 401 });

  const escrow = await getRevealEscrow(rec.request.txId);
  if (!escrow || escrow.ciphertextHash !== rec.ciphertextHash) {
    logger.error(ROUTE, "escrow_mismatch", { requestHash });
    return NextResponse.json({ error: "The escrow record no longer matches this request." }, { status: 409 });
  }
  logger.info(ROUTE, "package_fetched", { requestHash, member: access.id });
  const pkg: DisclosurePackage = {
    requestHash,
    signed: { request: rec.request, signature: rec.regulatorSignature },
    ciphertextHash: rec.ciphertextHash,
    approvals,
    escrow: escrow.envelope ? { envelope: escrow.envelope } : { ciphertext: escrow.ciphertext! },
  };
  return NextResponse.json(pkg);
}
