import { NextRequest, NextResponse } from "next/server";
import { getAuditSigner } from "@/lib/auditSigning";
import { createAuditCheckpoint, type AuditCheckpoint } from "@/policy/auditCheckpoint";
import { logger } from "@/lib/logger";

const ROUTE = "GET /api/cron/audit-checkpoint";
export const maxDuration = 60;

/** Most checkpoints one run creates, so a large backlog is worked off over several runs. */
const MAX_PER_RUN = 10;

/**
 * Vercel Cron (vercel.json): sign checkpoints over every audit record written
 * since the last one. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let signer;
  try {
    signer = getAuditSigner();
  } catch (err) {
    logger.error(ROUTE, "signer_misconfigured", { error: String(err) });
    return NextResponse.json({ error: "Audit signing is misconfigured." }, { status: 500 });
  }
  if (!signer) {
    return NextResponse.json({ error: "VERO_AUDIT_SIGNING_KEY is not set." }, { status: 503 });
  }

  const made: AuditCheckpoint[] = [];
  for (let i = 0; i < MAX_PER_RUN; i++) {
    const cp = await createAuditCheckpoint(signer);
    if (!cp) break;
    made.push(cp);
  }
  logger.info(ROUTE, "checkpoints_created", {
    count: made.length,
    toSeq: made.at(-1)?.toSeq ?? null,
  });
  return NextResponse.json({
    created: made.map(({ index, fromSeq, toSeq, chainHash }) => ({ index, fromSeq, toSeq, chainHash })),
  });
}
