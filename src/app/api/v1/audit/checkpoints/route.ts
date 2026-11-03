import { NextRequest, NextResponse } from "next/server";
import { getAuditSigner } from "@/lib/auditSigning";
import { listCheckpoints, getCheckpoint, checkpointLeaves } from "@/policy/auditCheckpoint";
import { logger } from "@/lib/logger";

const ROUTE = "GET /api/v1/audit/checkpoints";

/**
 * Public: signed audit checkpoints and the signing public key. Contains only
 * hashes and signatures — no record content, no agent ids.
 *
 *   GET /api/v1/audit/checkpoints            → latest 20 checkpoints
 *   GET /api/v1/audit/checkpoints?index=7    → checkpoint 7 plus its leaf hashes,
 *                                             to check a record you hold against it
 *
 * Verify offline with `npm run audit -- verify`.
 */
export async function GET(req: NextRequest) {
  let signer;
  try {
    signer = getAuditSigner();
  } catch (err) {
    logger.error(ROUTE, "signer_misconfigured", { error: String(err) });
    return NextResponse.json({ error: "Audit signing is misconfigured." }, { status: 500 });
  }
  const publicKey = signer?.publicKey ?? null;

  const indexParam = req.nextUrl.searchParams.get("index");
  if (indexParam !== null) {
    const index = Number(indexParam);
    if (!Number.isInteger(index) || index < 1) {
      return NextResponse.json({ error: "index must be a positive integer." }, { status: 422 });
    }
    const checkpoint = await getCheckpoint(index);
    if (!checkpoint) return NextResponse.json({ error: `No checkpoint ${index}.` }, { status: 404 });
    return NextResponse.json({ publicKey, checkpoint, leaves: await checkpointLeaves(checkpoint) });
  }

  return NextResponse.json({ publicKey, checkpoints: await listCheckpoints(20) });
}
