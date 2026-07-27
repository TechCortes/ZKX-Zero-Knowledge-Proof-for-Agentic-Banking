import { NextRequest, NextResponse } from "next/server";
import { authenticate, isAuthFailure, unauthorized } from "@/lib/auth";
import { getAuditLog } from "@/policy/auditLog";
import { logger } from "@/lib/logger";

const ROUTE = "GET /api/v1/audit";

/**
 * Returns the authenticated agent's own compliance audit trail — every
 * policy decision made about it, with the policy version that made the
 * call. See ROADMAP.md: this is phase 1 (audit log). Phase 2 (threshold
 * reveal) is what would let a *regulator*, not just the agent itself,
 * request this under legal process — not implemented here.
 */
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isAuthFailure(auth)) {
    logger.warn(ROUTE, "unauthorized", { errorCode: auth.errorCode });
    return unauthorized(auth.message, auth.errorCode);
  }
  const agent = auth;

  const entries = getAuditLog(agent.id);
  logger.info(ROUTE, "audit_fetched", { agentId: agent.id, count: entries.length });

  return NextResponse.json({ agentId: agent.id, count: entries.length, entries });
}
