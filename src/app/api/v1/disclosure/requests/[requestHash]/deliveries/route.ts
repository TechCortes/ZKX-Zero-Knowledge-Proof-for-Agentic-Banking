import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { loadApprovedRequest, loadRegistry, readJsonBody } from "@/disclosure/http";
import { checkAccess, checkDelivery, type Delivery } from "@/disclosure/delivery";
import { addDelivery, getDeliveries, getDisclosureRequest, publicSummary } from "@/disclosure/store";

const ROUTE = "/api/v1/disclosure/requests/:requestHash/deliveries";
type Ctx = { params: Promise<{ requestHash: string }> };

/**
 * POST: a member delivers its partial decryption, sealed to the regulator, with
 * a signed receipt (round 2). The receipt's hash goes into the audit chain.
 * Errors: 401 bad receipt, 409 already delivered / not approved, 410 expired, 422 malformed.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const reg = loadRegistry(`POST ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;
  const { requestHash } = await params;
  const loaded = await loadApprovedRequest(reg, requestHash);
  if (loaded instanceof NextResponse) return loaded;

  const body = await readJsonBody(req);
  const why = checkDelivery(reg, requestHash, loaded.rec.ciphertextHash, body);
  if (why) {
    logger.warn(`POST ${ROUTE}`, "rejected", { requestHash, error: why });
    return NextResponse.json({ error: why }, { status: why.includes("does not verify") ? 401 : 422 });
  }
  const d = body as Delivery;
  if (!(await addDelivery({ requestHash, index: d.index, box: d.box, signature: d.signature }))) {
    return NextResponse.json({ error: `Member ${d.index} already delivered for this request.` }, { status: 409 });
  }
  logger.info(`POST ${ROUTE}`, "delivered", { requestHash, member: d.index });
  return NextResponse.json(await publicSummary(reg, (await getDisclosureRequest(requestHash))!), { status: 201 });
}

/** GET: the requesting regulator only (ZQ-Sig, party "regulator", action "deliveries"). The sealed deliveries so far. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const reg = loadRegistry(`GET ${ROUTE}`);
  if (reg instanceof NextResponse) return reg;
  const { requestHash } = await params;
  const loaded = await loadApprovedRequest(reg, requestHash, { allowExpired: true });
  if (loaded instanceof NextResponse) return loaded;
  const access = checkAccess(reg, req.headers.get("authorization"), {
    requestHash, action: "deliveries", party: "regulator", regulatorId: loaded.rec.request.regulatorId,
  });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 401 });
  return NextResponse.json({ requestHash, threshold: reg.threshold, deliveries: await getDeliveries(requestHash) });
}
