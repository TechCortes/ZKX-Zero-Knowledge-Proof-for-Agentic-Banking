# ZKX — ZK-KYC for Agents

> Composable compliance without doxxing.

ZKX extends the [Open Wallet Standard](https://github.com/open-wallet-standard/core) with a zero-knowledge KYC credential for AI agents making payments.

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

- **Next.js 14** — app + API routes
- **circom + snarkjs** — Groth16 ZK proof system
- **@wallet-standard/core** — OWS wallet integration
- **Tailwind CSS** — UI

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

## OWS Extension

ZKX registers as the `zkx:kyc` feature in the wallet-standard registry:

```typescript
import { ZKX_KYC_FEATURE } from "@/wallet/ows-wallet";

// Agents declare this capability
wallet.features[ZKX_KYC_FEATURE].requestPayment({ amount, recipient });
```

---

Built at a hackathon — April 2026
