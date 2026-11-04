import { NextRequest, NextResponse } from "next/server";
import { loadRegistry, REQUEST_HASH_RE } from "@/disclosure/http";
import { getDisclosureRequest, publicSummary } from "@/disclosure/store";

const ROUTE = "GET /api/v1/disclosure/requests/:requestHash";

/** Public: one request's status and approvals. Hash-only, like the list. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestHash: string }> }) {
  const reg = loadRegistry(ROUTE);
  if (reg instanceof NextResponse) return reg;

  const { requestHash } = await params;
  if (!REQUEST_HASH_RE.test(requestHash)) {
    return NextResponse.json({ error: "requestHash must be 64 lowercase hex characters." }, { status: 422 });
  }
  const rec = await getDisclosureRequest(requestHash);
  if (!rec) return NextResponse.json({ error: "No such request." }, { status: 404 });
  return NextResponse.json(await publicSummary(reg, rec));
}
