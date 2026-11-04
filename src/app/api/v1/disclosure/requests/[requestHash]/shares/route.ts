import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { loadApprovedRequest, loadRegistry, readJsonBody } from "@/disclosure/http";
import { checkAccess, checkShareRelease, type ShareRelease } from "@/disclosure/delivery";
import { addShareRelease, getShareReleases } from "@/disclosure/store";

const ROUTE = "/api/v1/disclosure/requests/:requestHash/shares";
type Ctx = { params: Promise<{ requestHash: string }> };

/**
 * POST: a member releases its escrow share part, sealed separately to each
 * other member (round 1). Signed by the member's registry key; one per member.
 * Errors: 401 bad signature, 409 already released / not approved, 410 expired, 422 malformed.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const reg = loadRegistry(`POST ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;
  const { requestHash } = await params;
  const loaded = await loadApprovedRequest(reg, requestHash);
  if (loaded instanceof NextResponse) return loaded;

  const body = await readJsonBody(req);
  const why = checkShareRelease(reg, requestHash, body);
  if (why) {
    logger.warn(`POST ${ROUTE}`, "rejected", { requestHash, error: why });
    return NextResponse.json({ error: why }, { status: why.includes("does not verify") ? 401 : 422 });
  }
  const release = body as ShareRelease;
  const clean: ShareRelease = { requestHash, from: release.from, boxes: release.boxes, signature: release.signature };
  if (!(await addShareRelease(clean))) {
    return NextResponse.json({ error: `Member ${release.from} already released a share for this request.` }, { status: 409 });
  }
  logger.info(`POST ${ROUTE}`, "share_released", { requestHash, member: release.from });
  return NextResponse.json({ requestHash, from: release.from, released: true }, { status: 201 });
}

/** GET: members only (ZQ-Sig, action "shares"). Every release so far; each member can open only the boxes sealed to it. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const reg = loadRegistry(`GET ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;
  const { requestHash } = await params;
  const loaded = await loadApprovedRequest(reg, requestHash);
  if (loaded instanceof NextResponse) return loaded;
  const access = checkAccess(reg, req.headers.get("authorization"), {
    requestHash, action: "shares", party: "member", regulatorId: loaded.rec.request.regulatorId,
  });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 401 });
  return NextResponse.json({ requestHash, releases: await getShareReleases(requestHash) });
}
