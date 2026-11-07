import { NextRequest, NextResponse } from "next/server";
import { credentialRequestError, issueCredential } from "@/zkp/credential";
import { getDemoIssuerPrivateKey } from "@/zkp/issuerConfig";
import { kv } from "@/lib/kv";
import { logger } from "@/lib/logger";

/**
 * POST /api/v1/credentials/issue — the DEMO credential issuer (plan item I1).
 *
 * A real issuer is a KYC provider that checks documents before signing. This
 * one signs whatever { idHash, birthYear } it is sent, so the whole flow can
 * run end to end. Its credentials say `demo: true` and its name says so too.
 * It only runs when ZQUENT_ISSUER_PRIVATE_KEY is set. See docs/credentials.md.
 *
 * The request carries idHash (already a hash) and birthYear; never a raw ID.
 * Nothing is stored.
 */

const ROUTE = "POST /api/v1/credentials/issue";
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  const privateKey = await getDemoIssuerPrivateKey();
  if (!privateKey) {
    return NextResponse.json({ error: "The demo credential issuer is not enabled on this server." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const window = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const hits = await kv().incrby(`issuer_rl:${ip}:${window}`, 1, { ex: RATE_WINDOW_SECONDS });
  if (hits > RATE_LIMIT) {
    logger.warn(ROUTE, "rate_limited", {});
    return NextResponse.json({ error: "Too many credential requests. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { idHash, birthYear } = (body ?? {}) as Record<string, unknown>;
  const request = { idHash: idHash as string, birthYear: birthYear as number };
  const error = credentialRequestError(request);
  if (error) {
    logger.warn(ROUTE, "validation_failed", {});
    return NextResponse.json({ error }, { status: 422 });
  }

  const credential = await issueCredential(privateKey, request);
  logger.info(ROUTE, "credential_issued", { expiryDay: credential.subject.expiryDay });
  return NextResponse.json({ credential });
}
