import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorized } from "@/lib/auth";
import { getAgent } from "@/lib/registry";
import { getDailySpend, DAILY_ANONYMOUS_LIMIT } from "@/policy/engine";
import { logger } from "@/lib/logger";

const ROUTE = "GET /api/v1/agents/:agentId";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const agent = authenticate(req);
  if (!agent) {
    logger.warn(ROUTE, "unauthorized");
    return unauthorized();
  }

  const { agentId } = await params;

  if (agent.id !== agentId) {
    logger.warn(ROUTE, "forbidden", { requestedId: agentId, agentId: agent.id });
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const target = getAgent(agentId);
  if (!target) {
    logger.warn(ROUTE, "agent_not_found", { agentId });
    return NextResponse.json({ error: `Agent '${agentId}' not found.` }, { status: 404 });
  }

  const dailySpend = getDailySpend(agentId);
  const remaining = Math.max(0, DAILY_ANONYMOUS_LIMIT - dailySpend);
  const tier = dailySpend >= DAILY_ANONYMOUS_LIMIT ? "zk-verified" : "anonymous";

  logger.info(ROUTE, "agent_fetched", { agentId, tier, dailySpend });

  return NextResponse.json({
    agentId: target.id,
    commitment: target.commitment,
    createdAt: target.createdAt,
    compliance: { tier, dailySpend, dailyLimit: DAILY_ANONYMOUS_LIMIT, remainingAnonymous: remaining },
  });
}
