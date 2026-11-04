# ZQUENT — The Zero-Knowledge, Post-Quantum Trust Protocol for Agentic Banking and Micropayments

[![License: MIT](https://img.shields.io/badge/license-MIT-3DDC97.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-zkx--psi.vercel.app-blue)](https://zkx-psi.vercel.app)

> Every agent payment, proven. Composable compliance without doxxing.

_ZQUENT was previously named Vero Protocol. See [Renamed from Vero Protocol](#renamed-from-vero-protocol) for what changed and what stays compatible._

ZQUENT extends the [Open Wallet Standard](https://github.com/open-wallet-standard/core) (OWS) — the open, MIT-licensed wallet layer for AI agents originated by MoonPay, with 15+ contributing organizations including Circle, PayPal, Ripple, Solana Foundation, and Ethereum Foundation — with a zero-knowledge KYC credential for agent payments.

The problem is current, not hypothetical: as of April 2026 the x402 agent-payment ecosystem alone reports 69,000+ active agents and 165M+ transactions ([Coinbase](https://www.coinbase.com/developer-platform/discover/launches/x402)), now formalized as the Linux Foundation's x402 Foundation. Agent-to-agent payments already move real volume with no KYA (Know Your Agent) standard and no AML framework attached — that's the gap ZQUENT closes.

## Why fork this

This isn't a slide deck or a mocked-up demo — it's a working reference implementation of a ZK compliance stack for agentic payments:

- **A real Groth16 setup** — `kyc_credential.circom` is compiled, and a completed Powers of Tau ceremony + trusted setup (`public/zk/*.wasm`, `*.zkey`, `verification_key.json`) is committed. No stub verifier.
- **A live agent onboarding API** — `/api/v1/agents/register`, `/api/v1/payment`, `/api/v1/verify-proof` — token-scoped auth, policy evaluation, and proof verification wired end to end.
- **OWS wallet-standard integration** — registers `zquent:kyc` as a wallet-standard feature so it composes with the existing OWS policy engine instead of bolting on a parallel one.
- **A working registration UI** (`/register`) — the same flow demoed on the live site, not just an API you have to curl.

If you're building agent-facing payments and need a compliance layer that doesn't require agents (or their operators) to hand over PII, this is a starting point you can clone and ship from — not build from scratch.

## The Policy

| Daily Spend | Requirement |
|-------------|-------------|
| < $1,000/day | Anonymous micropayments — no KYC, no data collected |
| ≥ $1,000/day | Valid ZK proof of identity required |

Agents prove they have a valid identity **without revealing who they are**. Composable compliance without doxxing.

## Architecture

```
Agent Payment Request
       ↓
  Policy Engine (OWS zquent:kyc middleware)
       ↓
 Daily spend < $1k? ──yes──→ Approve (anonymous)
       ↓ no
 ZK KYC Challenge
       ↓
 Browser generates Groth16 proof (snarkjs + circom)
       ↓
 Server verifies proof (no personal data transmitted)
       ↓
 Payment approved
```

## ZK Circuit

The `kyc_credential` circuit (circom) proves:
1. The holder knows a preimage `(idHash, salt)` that hashes to a public `commitment` (Poseidon hash)
2. `currentYear - birthYear >= minAge` (age requirement)
3. It was made for one specific payment: a single-use `txNonce` the server issues in its 402 challenge, bound to that payment's amount and recipient. A proof can't be replayed or reused for another payment.

Private inputs never leave the browser.

**Threshold reveal (opt-in).** Institutions that need a lawful-disclosure path can set `ZQUENT_REVEAL_PUBLIC_KEY`. Proofs then use `kyc_reveal.circom`, which also encrypts the identity to a k-of-n consortium key and proves the ciphertext is honest. No single party, including the operator, can decrypt it. See [docs/threshold-reveal.md](./docs/threshold-reveal.md).

## Stack

- **Next.js 16** — app + API routes
- **circom + snarkjs** — Groth16 ZK proof system
- **@wallet-standard/core** — OWS wallet integration
- **Tailwind CSS** — UI

## OWS Ecosystem

OWS (v1.4.2) isn't just a CLI — it ships as a Node.js/Python SDK, a CLI, **and an MCP server**, so any MCP-speaking agent
framework (LangChain, AutoGPT, custom tool-callers) can attach a policy-gated wallet as a native tool with no
custom wallet code. It also isn't locked to one payment rail: alongside [x402](https://www.coinbase.com/developer-platform/discover/launches/x402)
(Coinbase/Cloudflare), it speaks Google's Agent Payments Protocol and Stripe/Tempo's Machine Payments Protocol (MPP)
for streaming micropayments. ZQUENT's `zquent:kyc` policy check sits in front of all of them — fork it once, and the
compliance boundary follows the agent regardless of which payment rail it uses.

## Quick Start

```bash
npm install
npm run dev
```

### Full ZK Setup (real proofs)

```bash
# 1. Install circom: https://docs.circom.io/getting-started/installation/

# 2. Compile the circuit
npm run compile-circuit

# 3. Download Powers of Tau (PSE Perpetual Powers of Tau, 2^14 — covers both circuits;
#    the old Hermez S3 bucket no longer serves files)
wget https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_14.ptau -O circuits/pot14_final.ptau

# 4. Generate proving + verification keys
npm run setup-zk

# 5. Run the app
npm run dev
```

## Sharing the Demo

To get a public shareable URL with no install or account required:

```bash
# Terminal 1 — run the app
npm run dev

# Terminal 2 — expose it publicly
npx localtunnel --port 3000
```

`localtunnel` will print a URL like `https://xyz.loca.lt` — share that with anyone. The tunnel stays live as long as the terminal is open.

## OWS Extension

ZQUENT registers as the `zquent:kyc` feature in the wallet-standard registry:

```typescript
import { ZQUENT_KYC_FEATURE } from "@/wallet/ows-wallet";

// Agents declare this capability
wallet.features[ZQUENT_KYC_FEATURE].requestPayment({ amount, recipient });
```

## Extend it

A few concrete starting points if you fork:

- **Swap the threshold** — the $1,000 FATF Rec. 16 cutoff is one constant in the policy engine. Point it at your own risk model.
- **Extend the circuit** — add a new private input (jurisdiction, accreditation status, sanctions-list exclusion) to `kyc_credential.circom` and re-run the trusted setup.
- **Bring your own chain** — the OWS wallet integration already speaks CAIP-2 across ten chain families.
- **Replace the registry** — the `/api/v1/agents` onboarding API is a reference, not a requirement. Swap it for your own agent identity system and keep the ZK verification boundary as-is.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup and how to propose changes.

## Roadmap

By default the verifier learns nothing beyond "credential valid, age ≥ 18". Institutions also need a lawful-disclosure path (EU eIDAS 2 and FATF Travel Rule guidance both expect one), so the audit log and opt-in k-of-n threshold reveal are shipped. See [ROADMAP.md](./ROADMAP.md) and [docs/threshold-reveal.md](./docs/threshold-reveal.md).

Shipped since: post-quantum sealed escrow for identity ciphertexts (X-Wing: ML-KEM-768 + X25519) and a tamper-evident audit chain with Ed25519 + ML-DSA-65 signed checkpoints, both opt-in. The ZK proofs themselves remain classical Groth16.

Next: a regulator request flow, a multi-party trusted setup, and issuer-signed credentials.

**Status:** testnet reference implementation. The circuits have not been independently audited, the Groth16 setup has a single contributor, and the demo credential is self-asserted. Don't use it to protect real funds or identities yet.

## Renamed from Vero Protocol

The project was renamed from Vero Protocol to **ZQUENT**. Nothing already deployed or stored has to change:

| What | New | Still accepted |
| --- | --- | --- |
| Env vars | `ZQUENT_REVEAL_PUBLIC_KEY`, `ZQUENT_ESCROW_KEYS`, `ZQUENT_AUDIT_SIGNING_KEY`, `ZQUENT_REGISTRY_FILE`, `ZQUENT_REGISTRY_MEMBERS_ID`, `ZQUENT_DISCLOSURE_DAILY_LIMIT` | `VERO_*` names (read as fallback, one-time warning) |
| Wallet-standard feature | `zquent:kyc` | `vero:kyc` (registered as an alias of the same feature) |
| Assistant API | `/api/assistant` | `/api/vera` (same handler) |
| Browser storage | `zquent_agent` | `zkx_agent` (migrated once on load) |
| Transaction ids | `zquent_<uuid>` | `zkx_…` ids in existing audit records |
| CLIs | `scripts/zquent-reveal.ts`, `scripts/zquent-audit.ts`, `scripts/zquent-registry.ts`, `scripts/zquent-disclosure.ts` | `npm run reveal` / `audit` / `registry` / `disclosure` unchanged |

The aliases are deprecated and will be removed in a cleanup release about 90 days after the rename.

**Not renamed, on purpose:** the wire-format tags `vero-reveal/v1`, `vero-escrow/v2`, `vero-escrow-keys/v1`, `vero-audit-checkpoint/v1`, the disclosure formats (`vero-registry/v1`, `vero-signing-key/v1`, `vero-kem-key/v1`, `vero-disclosure-request/v1`, `vero-disclosure-approval/v1`) and the `vero-audit-signing` and `vero-registry-signing` HKDF labels. They are written into stored ciphertexts, sealed envelopes, signed checkpoints and signed registry entries, so changing them would orphan existing data. A test pins them.

## License

MIT — see [LICENSE](./LICENSE). Fork it, ship it, no attribution required (though a star is always appreciated).

---

Built at a hackathon — April 2026
