import { NextRequest, NextResponse } from "next/server";
import { getAgentByApiKey, isAgentExpired, type Agent } from "./registry";
import { OWSErrorCode } from "./ows-errors";

export interface AuthFailure {
  errorCode: OWSErrorCode;
  message: string;
  status: 401 | 403;
}

export function authenticate(req: NextRequest): Agent | AuthFailure {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { errorCode: OWSErrorCode.API_KEY_NOT_FOUND, message: "Missing Bearer token.", status: 401 };
  }

  const agent = getAgentByApiKey(header.slice(7));
  if (!agent) {
    return { errorCode: OWSErrorCode.API_KEY_NOT_FOUND, message: "Invalid API key.", status: 401 };
  }

  if (isAgentExpired(agent)) {
    return { errorCode: OWSErrorCode.API_KEY_EXPIRED, message: "API key has expired.", status: 401 };
  }

  return agent;
}

export function isAuthFailure(result: Agent | AuthFailure): result is AuthFailure {
  return "errorCode" in result;
}

export function unauthorized(message = "Invalid or missing API key.", errorCode?: OWSErrorCode) {
  return NextResponse.json(
    { error: message, ...(errorCode ? { errorCode } : {}) },
    { status: 401 }
  );
}
