# Contributing to ZQUENT

ZQUENT is MIT licensed — forks, PRs, and standalone derivatives are all welcome. This is a short guide to the actual dev workflow, not a formal process.

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
npm run ceremony -- verify kyc_credential   # checks the committed key against your build

# Optional: threshold-reveal circuit
npm run compile-circuit:reveal
npm run ceremony -- verify kyc_reveal

# Proofs need a credential issuer configured
npm run issuer -- keygen >> .env.local
```

`npm run setup-zk[:reveal]` still makes a single-contributor key for local circuit work. It overwrites `public/zk/`, so don't commit its output; shared keys come from the ceremony ([docs/ceremony.md](./docs/ceremony.md)).

Node 20.19+ is required (Next 16, Vitest 4, `@noble/post-quantum`); `.nvmrc` pins 22.

## Tests

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run test:circuit  # ZK circuit tests only (src/zkp/)
npm run test:coverage
```

## Where to make changes

- **Policy logic** (thresholds, spend windows) lives in the OWS `zquent:kyc` middleware — see the Architecture section in [README.md](./README.md).
- **The circuits** are `circuits/kyc_credential.circom` and `circuits/kyc_reveal.circom`; the shared credential checks are in `circuits/lib/credential.circom` ([docs/credentials.md](./docs/credentials.md)). Changing a circuit means recompiling, iterating locally with `npm run setup-zk`, and then a new ceremony before merging ([docs/ceremony.md](./docs/ceremony.md)).
- **Onboarding API** routes are under `src/app/api/v1/agents/` and `src/app/api/v1/payment/` — the reference agent registry lives here if you want to see how tokens and policy checks are wired.
- **Audit log** — `src/policy/auditLog.ts` + `GET /api/v1/audit`. See [ROADMAP.md](./ROADMAP.md) for why this exists.
- **Threshold reveal** — `circuits/kyc_reveal.circom`, `src/zkp/reveal.ts`, `scripts/zquent-reveal.ts` (`npm run reveal`). Spec: [docs/threshold-reveal.md](./docs/threshold-reveal.md). Opt-in via `ZQUENT_REVEAL_PUBLIC_KEY`.
- **UI** — `src/app/page.tsx` (landing page), `src/app/register/` + `src/components/AgentRegistrationWizard.tsx` (registration flow), `src/components/DemoWidget.tsx` (live demo).

## Proposing a change

Open a PR with a short description of what changed and why. For anything touching the circuit or the policy engine, include what a verifier learns/doesn't learn after your change — that boundary is the entire point of the project, so it should stay explicit.

## Biggest open item: [ROADMAP.md](./ROADMAP.md)

If you want to work on something with real impact, start there. The audit log and opt-in threshold reveal are shipped. Post-quantum escrow (X-Wing) and the ML-DSA-65 signed audit chain are shipped too. Open items: a regulator-facing request flow, replacing the trusted-dealer keygen with a DKG, and a multi-party Groth16 setup ceremony.
