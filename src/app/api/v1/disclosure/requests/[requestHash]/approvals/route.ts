import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isValidHybridSignature } from "@/lib/auditSigning";
import { loadRegistry, readJsonBody, REQUEST_HASH_RE } from "@/disclosure/http";
import { checkApproval } from "@/disclosure/requests";
import { addApproval, getDisclosureRequest, publicSummary } from "@/disclosure/store";

const ROUTE = "POST /api/v1/disclosure/requests/:requestHash/approvals";

/**
 * A registered approver signs off on a request. Body: `{ approverId, signature }`,
 * where signature is over SHA3-256("vero-disclosure-approval/v1|" ‖ requestHash).
 * The approver gets the request, the ciphertextHash and the legal document from
 * the regulator out of band, recomputes requestHash and only then signs.
 *
 * Errors: 401 bad signature or unknown approver, 404 no such request,
 * 409 already approved by this approver, 410 expired, 422 malformed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ requestHash: string }> }) {
  const reg = loadRegistry(ROUTE);
  if (reg instanceof NextResponse) return reg;

  const { requestHash } = await params;
  if (!REQUEST_HASH_RE.test(requestHash)) {
    return NextResponse.json({ error: "requestHash must be 64 lowercase hex characters." }, { status: 422 });
  }
  const body = (await readJsonBody(req)) as { approverId?: unknown; signature?: unknown } | undefined;
  if (!body || typeof body.approverId !== "string" || !isValidHybridSignature(body.signature)) {
    return NextResponse.json({ error: "Body must be { approverId, signature }." }, { status: 422 });
  }

  const rec = await getDisclosureRequest(requestHash);
  if (!rec) return NextResponse.json({ error: "No such request." }, { status: 404 });

  const now = new Date();
  if (rec.request.expiresAt <= now.toISOString()) {
    return NextResponse.json({ error: "This request has expired." }, { status: 410 });
  }
  const why = checkApproval(reg, requestHash, body.approverId, body.signature, now);
  if (why) {
    logger.warn(ROUTE, "rejected", { requestHash, approverId: body.approverId, error: why });
    return NextResponse.json({ error: why }, { status: 401 });
  }

  const added = await addApproval(reg, rec, { approverId: body.approverId, signature: body.signature, approvedAt: now.toISOString() });
  if (!added) return NextResponse.json({ error: "This approver already approved this request." }, { status: 409 });

  logger.info(ROUTE, "approved", { requestHash, approverId: body.approverId });
  return NextResponse.json(await publicSummary(reg, rec, now), { status: 201 });
}
