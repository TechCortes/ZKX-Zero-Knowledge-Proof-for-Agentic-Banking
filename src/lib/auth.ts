import { NextRequest, NextResponse } from "next/server";
import { getAgentByApiKey, type Agent } from "./registry";

export function authenticate(req: NextRequest): Agent | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return getAgentByApiKey(header.slice(7)) ?? null;
}

export function unauthorized(message = "Invalid or missing API key.") {
  return NextResponse.json({ error: message }, { status: 401 });
}
