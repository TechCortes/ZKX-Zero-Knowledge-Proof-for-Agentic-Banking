# Roadmap

Vero Protocol's current implementation optimizes for one property: the verifier learns nothing beyond "credential valid, age ≥ 18." That's the right default for the anonymous-micropayment tier, and it's what makes the demo compelling. It is **not**, by itself, enough for an institution to run in production.

## Why: the disclosure gap

Regulatory research (EU eIDAS 2, FATF Travel Rule guidance) is consistent on one point: zero-knowledge proofs are an accepted substitute for raw KYC documents, but compliance programs are expected to retain a **lawful disclosure path** — a way to unmask a specific transaction under legal process (subpoena, sanctions hit, travel-rule request) without unmasking everyone else's transactions by default. "The verifier learns nothing, ever, full stop" is a strong developer pitch and a weak institutional one — a compliance team evaluating this for a pilot will ask "what happens when a regulator asks us who this was," and today Vero Protocol has no answer.

This is scoped as a real feature, not a messaging fix, because it requires new cryptographic machinery, not just new copy.

## Proposed design: threshold reveal + audit log

Two independent pieces, both opt-in and additive to the existing circuit — anonymous-tier payments are untouched.

### 1. Audit log — ✅ shipped

Every policy decision (anonymous approval, KYC challenge, proof approval/rejection, policy denial) writes an append-only record:

```
{ commitment?, txId?, policyVersionHash, timestamp, thresholdMet: bool, dailyTotal }
```

No PII in the log — `commitment` is already public and non-reversible on its own. `policyVersionHash` (`computePolicyVersionHash` in `src/policy/engine.ts`) means a change to the $1,000 threshold or any policy rule doesn't retroactively change what a past decision "meant" — you can always answer "what rule was active when this was approved."

Implementation: `src/policy/auditLog.ts` (in-memory, DB-shaped — same convention as `registry.ts`, swap the array for a real append-only store in production), hooked into `POST /api/v1/payment` and `POST /api/v1/verify-proof`. Query your own trail via `GET /api/v1/audit` (bearer-authenticated, scoped to the calling agent). A real regulator-facing query path — as opposed to an agent reading its own log — is part of phase 2 below, not this phase.

### 2. Threshold reveal (the actual ZK work) — ✅ shipped (opt-in)

At proof-generation time, the circuit additionally encrypts the private inputs (`idHash`, `birthYear`, `salt`) under a **k-of-n threshold public key**, where the `n` key-holders are a consortium the *institution* designates — e.g., independent legal/compliance/custody parties, not Vero Protocol and not any single verifier. The resulting ciphertext is stored alongside the commitment. In the common case it's just opaque bytes; it becomes readable only if `k` of the `n` designated parties cooperate to decrypt it, which is the point — no single party (including the platform operator) can unilaterally deanonymize a user, but a legally-compelled, multi-party disclosure process is possible.

**Status:** ✅ the circuit (`circuits/kyc_reveal.circom`), the ciphertext format and threshold-decryption contract ([docs/threshold-reveal.md](./docs/threshold-reveal.md)), server wiring behind `VERO_REVEAL_PUBLIC_KEY`, and a reference CLI (`npm run reveal`) are in. Circuit keys are generated (`public/zk/kyc_reveal*`, 9,030 constraints, PSE pot14) and real-proof tests pass.

Vero Protocol's job here is to define the **interface** cleanly — the ciphertext format, the circuit extension, and the threshold-decryption contract — so that an institution forking this plugs in its *own* key-management/HSM infrastructure for the actual threshold ceremony. Vero Protocol does not run the ceremony; it defines the shape of the boundary.

### What this unlocks

A compliance team can pilot Vero Protocol and truthfully tell their regulator: "we can prove KYC status without collecting PII, we retain an auditable record of every policy decision, and we can unmask a specific transaction under legal process with the cooperation of a designated multi-party consortium — but not unilaterally, and not in bulk." That sentence is what turns "interesting ZK demo" into "thing our legal team will actually sign off piloting."

## Sequencing

1. ✅ Audit log — no cryptography, mechanical, ships independently of everything else.
2. ✅ Threshold-reveal circuit extension + ciphertext format spec.
3. ✅ Reference (non-production) threshold-decryption CLI — `npm run reveal -- demo`.

## Explicitly out of scope for Vero Protocol itself

Running an actual threshold-decryption consortium, KYC document verification/issuance, and anything resembling custody of the reveal keys. Vero Protocol defines the protocol boundary; institutions that fork this own the actual disclosure infrastructure, the same way they'd own their own key management today.

## Contributing

The audit log (#1) and the threshold-reveal code (#2, #3) are in. Open items: binding proofs to a transaction nonce, and a regulator-facing request flow. See [docs/threshold-reveal.md](./docs/threshold-reveal.md). See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup.
