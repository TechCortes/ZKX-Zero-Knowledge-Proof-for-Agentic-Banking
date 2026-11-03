import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as cron } from "./route";
import { GET as checkpoints } from "@/app/api/v1/audit/checkpoints/route";
import { recordAuditEntry } from "@/policy/auditLog";
import { verifyCheckpoints, verifyRecordInclusion } from "@/policy/auditCheckpoint";
import { generateAuditSigningSeed } from "@/lib/auditSigning";

const req = (url: string, auth?: string) =>
  new NextRequest(url, auth ? { headers: { authorization: auth } } : undefined);

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.VERO_AUDIT_SIGNING_KEY;
});

describe("audit checkpoint routes", () => {
  it("cron rejects calls without the secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(req("http://x/api/cron/audit-checkpoint"))).status).toBe(401);
    expect((await cron(req("http://x/api/cron/audit-checkpoint", "Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await cron(req("http://x/api/cron/audit-checkpoint", "Bearer undefined"))).status).toBe(401);
  });

  it("cron reports 503 when no signing key is configured", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(req("http://x/api/cron/audit-checkpoint", "Bearer s3cret"))).status).toBe(503);
  });

  it("cron signs a checkpoint that the public route serves and that verifies", async () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.VERO_AUDIT_SIGNING_KEY = generateAuditSigningSeed();
    const record = await recordAuditEntry({
      agentId: "route-agent", policyVersionHash: "x", decision: "approved_anonymous",
      thresholdMet: false, dailyTotal: 1,
    });

    const run = await cron(req("http://x/api/cron/audit-checkpoint", "Bearer s3cret"));
    expect(run.status).toBe(200);
    expect((await run.json()).created.length).toBeGreaterThan(0);

    const listed = await (await checkpoints(req("http://x/api/v1/audit/checkpoints"))).json();
    expect(verifyCheckpoints([...listed.checkpoints].reverse(), listed.publicKey)).toEqual({ ok: true });

    const cp = listed.checkpoints.find((c: { fromSeq: number; toSeq: number }) => record.seq! >= c.fromSeq && record.seq! <= c.toSeq);
    const detail = await (await checkpoints(req(`http://x/api/v1/audit/checkpoints?index=${cp.index}`))).json();
    expect(JSON.stringify(detail)).not.toContain("route-agent"); // hashes only
    expect(verifyRecordInclusion(record, detail.checkpoint, detail.leaves)).toEqual({ ok: true });

    expect((await checkpoints(req("http://x/api/v1/audit/checkpoints?index=0"))).status).toBe(422);
    expect((await checkpoints(req("http://x/api/v1/audit/checkpoints?index=99999"))).status).toBe(404);
  });
});
