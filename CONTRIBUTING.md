# Contributing to Vero Protocol

Vero Protocol is MIT licensed — forks, PRs, and standalone derivatives are all welcome. This is a short guide to the actual dev workflow, not a formal process.

## Dev setup

```bash
npm install
npm run dev
```

The verifier fails closed: without a compiled circuit, `POST /api/v1/verify-proof` rejects every proof rather than auto-accepting (`public/zk/verification_key.json` must be present). To work with real ZK proofs:

```bash
# Install circom: https://docs.circom.io/getting-started/installation/
npm run compile-circuit

# PSE Perpetual Powers of Tau, 2^14 — covers both circuits
wget https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_14.ptau -O circuits/pot14_final.ptau
npm run setup-zk

# Optional: threshold-reveal circuit
npm run compile-circuit:reveal
npm run setup-zk:reveal
```

Node 20.19+ is required (Next 16, Vitest 4, `@noble/post-quantum`); `.nvmrc` pins 22.

## Tests

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run test:circuit  # ZK circuit tests only (src/zkp/)
npm run test:coverage
```

## Where to make changes

- **Policy logic** (thresholds, spend windows) lives in the OWS `vero:kyc` middleware — see the Architecture section in [README.md](./README.md).
- **The circuit** is `circuits/kyc_credential.circom`. Adding a new private/public input means re-running `npm run compile-circuit` and `npm run setup-zk` to regenerate the wasm/zkey/verification key.
- **Onboarding API** routes are under `src/app/api/v1/agents/` and `src/app/api/v1/payment/` — the reference agent registry lives here if you want to see how tokens and policy checks are wired.
- **Audit log** — `src/policy/auditLog.ts` + `GET /api/v1/audit`. See [ROADMAP.md](./ROADMAP.md) for why this exists.
- **Threshold reveal** — `circuits/kyc_reveal.circom`, `src/zkp/reveal.ts`, `scripts/vero-reveal.ts` (`npm run reveal`). Spec: [docs/threshold-reveal.md](./docs/threshold-reveal.md). Opt-in via `VERO_REVEAL_PUBLIC_KEY`.
- **UI** — `src/app/page.tsx` (landing page), `src/app/register/` + `src/components/AgentRegistrationWizard.tsx` (registration flow), `src/components/DemoWidget.tsx` (live demo).

## Proposing a change

Open a PR with a short description of what changed and why. For anything touching the circuit or the policy engine, include what a verifier learns/doesn't learn after your change — that boundary is the entire point of the project, so it should stay explicit.

## Biggest open item: [ROADMAP.md](./ROADMAP.md)

If you want to work on something with real impact, start there. The audit log and opt-in threshold reveal are shipped. Open items: a regulator-facing request flow, post-quantum protection (ML-KEM-768 / ML-DSA-65) for escrowed identity data and the audit trail, replacing the trusted-dealer keygen with a DKG, and a multi-party Groth16 setup ceremony.
