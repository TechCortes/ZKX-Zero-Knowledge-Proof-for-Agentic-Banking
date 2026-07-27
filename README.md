# ZKX — Zero-Knowledge Proof for Agentic Banking

[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-zkx--psi.vercel.app-blue)](https://zkx-psi.vercel.app)

> Composable compliance without doxxing.

ZKX extends the [Open Wallet Standard](https://github.com/open-wallet-standard/core) (OWS) — the open, MIT-licensed wallet layer for AI agents originated by MoonPay, with 15+ contributing organizations including Circle, PayPal, Ripple, Solana Foundation, and Ethereum Foundation — with a zero-knowledge KYC credential for agent payments.

The problem is current, not hypothetical: as of April 2026 the x402 agent-payment ecosystem alone reports 69,000+ active agents and 165M+ transactions ([Coinbase](https://www.coinbase.com/developer-platform/discover/launches/x402)), now formalized as the Linux Foundation's x402 Foundation. Agent-to-agent payments already move real volume with no KYA (Know Your Agent) standard and no AML framework attached — that's the gap ZKX closes.

## Why fork this

This isn't a slide deck or a mocked-up demo — it's a working reference implementation of a ZK compliance stack for agentic payments:

- **A real Groth16 setup** — `kyc_credential.circom` is compiled, and a completed Powers of Tau ceremony + trusted setup (`public/zk/*.wasm`, `*.zkey`, `verification_key.json`) is committed. No stub verifier.
- **A live agent onboarding API** — `/api/v1/agents/register`, `/api/v1/payment`, `/api/v1/verify-proof` — token-scoped auth, policy evaluation, and proof verification wired end to end.
- **OWS wallet-standard integration** — registers `zkx:kyc` as a wallet-standard feature so it composes with the existing OWS policy engine instead of bolting on a parallel one.
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
  Policy Engine (OWS zkx:kyc middleware)
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

Private inputs never leave the browser.

## Stack

- **Next.js 16** — app + API routes
- **circom + snarkjs** — Groth16 ZK proof system
- **@wallet-standard/core** — OWS wallet integration
- **Tailwind CSS** — UI

## OWS Ecosystem

OWS (v1.4.2) isn't just a CLI — it ships as a Node.js/Python SDK, a CLI, **and an MCP server**, so any MCP-speaking agent
framework (LangChain, Claude agents, custom tool-callers) can attach a policy-gated wallet as a native tool with no
custom wallet code. It also isn't locked to one payment rail: alongside [x402](https://www.coinbase.com/developer-platform/discover/launches/x402)
(Coinbase/Cloudflare), it speaks Google's Agent Payments Protocol and Stripe/Tempo's Machine Payments Protocol (MPP)
for streaming micropayments. ZKX's `zkx:kyc` policy check sits in front of all of them — fork it once, and the
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

# 3. Download Powers of Tau (Hermez ceremony, 2^12)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O circuits/pot12_final.ptau

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

ZKX registers as the `zkx:kyc` feature in the wallet-standard registry:

```typescript
import { ZKX_KYC_FEATURE } from "@/wallet/ows-wallet";

// Agents declare this capability
wallet.features[ZKX_KYC_FEATURE].requestPayment({ amount, recipient });
```

## Extend it

A few concrete starting points if you fork:

- **Swap the threshold** — the $1,000 FATF Rec. 16 cutoff is one constant in the policy engine. Point it at your own risk model.
- **Extend the circuit** — add a new private input (jurisdiction, accreditation status, sanctions-list exclusion) to `kyc_credential.circom` and re-run the trusted setup.
- **Bring your own chain** — the OWS wallet integration already speaks CAIP-2 across ten chain families.
- **Replace the registry** — the `/api/v1/agents` onboarding API is a reference, not a requirement. Swap it for your own agent identity system and keep the ZK verification boundary as-is.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup and how to propose changes.

## Roadmap

The zero-knowledge property today means the verifier learns nothing beyond "credential valid, age ≥ 18" — great for the anonymous tier, not sufficient on its own for institutional piloting, which needs a lawful-disclosure path (EU eIDAS 2 and FATF Travel Rule guidance both expect one). See [ROADMAP.md](./ROADMAP.md) for the proposed threshold-reveal + audit-log design that closes that gap without breaking anonymity by default.

## License

MIT — see [LICENSE](./LICENSE). Fork it, ship it, no attribution required (though a star is always appreciated).

---

Built at a hackathon — April 2026
