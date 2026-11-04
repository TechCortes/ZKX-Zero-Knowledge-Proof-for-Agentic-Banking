import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { getAuditLog } from "@/policy/auditLog";
import { logger } from "@/lib/logger";

const ROUTE = "GET /api/v1/audit";

/**
 * Returns the authenticated agent's own compliance audit trail — every
 * policy decision made about it, with the policy version that made the
 * call. Records carry `seq` and `recordHash`, so an agent can check any of
 * them against the signed public checkpoints (GET /api/v1/audit/checkpoints,
 * docs/audit-chain.md). Regulators use /api/v1/disclosure/requests instead.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (isAuthFailure(auth)) {
    logger.warn(ROUTE, "unauthorized", { errorCode: auth.errorCode });
    return unauthorized(auth.message, auth.errorCode);
  }
  const agent = auth;

  const entries = await getAuditLog(agent.id);
  logger.info(ROUTE, "audit_fetched", { agentId: agent.id, count: entries.length });

  return NextResponse.json({ agentId: agent.id, count: entries.length, entries });
}
