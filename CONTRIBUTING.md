# Contributing to ZKX

ZKX is MIT licensed — forks, PRs, and standalone derivatives are all welcome. This is a short guide to the actual dev workflow, not a formal process.

## Dev setup

```bash
npm install
npm run dev
```

The app runs in demo mode without a compiled circuit (the verifier auto-accepts proofs when `public/zk/verification_key.json` is absent). To work with real ZK proofs:

```bash
# Install circom: https://docs.circom.io/getting-started/installation/
npm run compile-circuit

wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O circuits/pot12_final.ptau
npm run setup-zk
```

## Tests

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run test:circuit  # ZK circuit tests only (src/zkp/)
npm run test:coverage
```

## Where to make changes

- **Policy logic** (thresholds, spend windows) lives in the OWS `zkx:kyc` middleware — see the Architecture section in [README.md](./README.md).
- **The circuit** is `circuits/kyc_credential.circom`. Adding a new private/public input means re-running `npm run compile-circuit` and `npm run setup-zk` to regenerate the wasm/zkey/verification key.
- **Onboarding API** routes are under `src/app/api/v1/agents/` and `src/app/api/v1/payment/` — the reference agent registry lives here if you want to see how tokens and policy checks are wired.
- **UI** — `src/app/page.tsx` (landing page), `src/app/register/` + `src/components/AgentRegistrationWizard.tsx` (registration flow), `src/components/DemoWidget.tsx` (live demo).

## Proposing a change

Open a PR with a short description of what changed and why. For anything touching the circuit or the policy engine, include what a verifier learns/doesn't learn after your change — that boundary is the entire point of the project, so it should stay explicit.
