import { describe, it, expect, afterEach } from "vitest";
import { REGISTRY_FORMAT, SIGNING_KEY_FORMAT, KEM_KEY_FORMAT, REGISTRY_SIGNING_DOMAIN } from "@/disclosure/keyRegistry";
import { REQUEST_FORMAT, APPROVAL_TAG } from "@/disclosure/requests";
import { ACCESS_TAG, SHARE_TAG, DELIVERY_FORMAT } from "@/disclosure/delivery";
import { SEALED_BOX_FORMAT } from "@/disclosure/sealedBox";
import { DKG_FORMAT, DKG_SECRET_FORMAT } from "@/zkp/dkg";
import { readProtocolEnv, envLabel } from "./env";
import { AGENT_STORAGE_KEY, LEGACY_AGENT_STORAGE_KEY, migrateLegacyAgentStorage } from "./agentStorage";
import { createZquentWallet, createVeroWallet, ZQUENT_KYC_FEATURE, VERO_KYC_FEATURE } from "@/wallet/ows-wallet";
import { getEscrowKeySet, getRevealPublicKey } from "@/zkp/revealConfig";
import { REVEAL_FORMAT } from "@/zkp/reveal";
import { ESCROW_FORMAT, ESCROW_KEYS_FORMAT } from "@/zkp/escrowSeal";
import { CHECKPOINT_FORMAT } from "@/policy/auditCheckpoint";

const NAMES = ["REVEAL_PUBLIC_KEY", "ESCROW_KEYS", "AUDIT_SIGNING_KEY"] as const;

afterEach(() => {
  for (const n of NAMES) {
    delete process.env[`ZQUENT_${n}`];
    delete process.env[`VERO_${n}`];
  }
});

describe("ZQUENT env vars with VERO_ fallback", () => {
  it("prefers ZQUENT_ over VERO_", () => {
    process.env.ZQUENT_ESCROW_KEYS = "new";
    process.env.VERO_ESCROW_KEYS = "old";
    expect(readProtocolEnv("ESCROW_KEYS")).toBe("new");
  });

  it("falls back to the legacy VERO_ name", () => {
    process.env.VERO_AUDIT_SIGNING_KEY = "  legacy  ";
    expect(readProtocolEnv("AUDIT_SIGNING_KEY")).toBe("legacy");
  });

  it("treats blank values as unset", () => {
    process.env.ZQUENT_REVEAL_PUBLIC_KEY = "   ";
    expect(readProtocolEnv("REVEAL_PUBLIC_KEY")).toBeUndefined();
  });

  it("names both variables in error messages", () => {
    expect(envLabel("ESCROW_KEYS")).toBe("ZQUENT_ESCROW_KEYS (or legacy VERO_ESCROW_KEYS)");
  });

  it("is what the reveal and escrow config actually read", async () => {
    process.env.ZQUENT_REVEAL_PUBLIC_KEY = "1,2"; // not a curve point → must throw, not be ignored
    await expect(getRevealPublicKey()).rejects.toThrow(/ZQUENT_REVEAL_PUBLIC_KEY/);
    process.env.ZQUENT_ESCROW_KEYS = "not json";
    expect(() => getEscrowKeySet()).toThrow(/ZQUENT_ESCROW_KEYS/);
  });
});

describe("browser storage key migration", () => {
  function memoryStorage(init: Record<string, string> = {}) {
    const m = new Map(Object.entries(init));
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      dump: () => Object.fromEntries(m),
    };
  }

  it("moves zkx_agent to zquent_agent once", () => {
    const s = memoryStorage({ [LEGACY_AGENT_STORAGE_KEY]: '{"agentId":"a"}' });
    migrateLegacyAgentStorage(s);
    expect(s.dump()).toEqual({ [AGENT_STORAGE_KEY]: '{"agentId":"a"}' });
    migrateLegacyAgentStorage(s);
    expect(s.dump()).toEqual({ [AGENT_STORAGE_KEY]: '{"agentId":"a"}' });
  });

  it("never overwrites an existing zquent_agent", () => {
    const s = memoryStorage({ [LEGACY_AGENT_STORAGE_KEY]: "old", [AGENT_STORAGE_KEY]: "new" });
    migrateLegacyAgentStorage(s);
    expect(s.dump()).toEqual({ [AGENT_STORAGE_KEY]: "new" });
  });

  it("never throws when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => {}, removeItem: () => {} };
    expect(() => migrateLegacyAgentStorage(broken)).not.toThrow();
  });
});

describe("wallet-standard feature alias", () => {
  it("registers zquent:kyc and the deprecated vero:kyc as the same feature", () => {
    const w = createZquentWallet("agent-1", "123", "ows_key_x", ["eip155:1"]);
    expect(ZQUENT_KYC_FEATURE).toBe("zquent:kyc");
    expect(w.features[ZQUENT_KYC_FEATURE]).toBeDefined();
    expect(w.features[VERO_KYC_FEATURE]).toBe(w.features[ZQUENT_KYC_FEATURE]);
    expect(w.metadata[VERO_KYC_FEATURE]).toBe(w.metadata[ZQUENT_KYC_FEATURE]);
    expect(w.name).toBe("ZQUENT Agent Wallet");
    expect(createVeroWallet).toBe(createZquentWallet);
  });
});

describe("frozen wire formats", () => {
  // Stored ciphertexts, sealed envelopes and signed checkpoints carry these tags.
  // Renaming them would orphan existing data, so they must not change.
  it("keep their pre-rename values", () => {
    expect(REVEAL_FORMAT).toBe("vero-reveal/v1");
    expect(ESCROW_FORMAT).toBe("vero-escrow/v2");
    expect(ESCROW_KEYS_FORMAT).toBe("vero-escrow-keys/v1");
    expect(CHECKPOINT_FORMAT).toBe("vero-audit-checkpoint/v1");
    // Disclosure: signed registry entries, key files, requests and approvals.
    expect(REGISTRY_FORMAT).toBe("vero-registry/v1");
    expect(SIGNING_KEY_FORMAT).toBe("vero-signing-key/v1");
    expect(KEM_KEY_FORMAT).toBe("vero-kem-key/v1");
    expect(REGISTRY_SIGNING_DOMAIN).toBe("vero-registry-signing");
    expect(REQUEST_FORMAT).toBe("vero-disclosure-request/v1");
    expect(APPROVAL_TAG).toBe("vero-disclosure-approval/v1");
    expect(ACCESS_TAG).toBe("vero-disclosure-access/v1");
    expect(SHARE_TAG).toBe("vero-disclosure-share/v1");
    expect(DELIVERY_FORMAT).toBe("vero-disclosure-delivery/v1");
    expect(SEALED_BOX_FORMAT).toBe("vero-sealed-box/v1");
    expect(DKG_FORMAT).toBe("vero-dkg/v1");
    expect(DKG_SECRET_FORMAT).toBe("vero-dkg-secret/v1");
  });
});
