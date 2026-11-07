# Issuer-signed credentials and the daily nullifier

Plan items **I1** (issuer-signed credential) and the circuit half of **P1** (per-person daily nullifier).

Before this change, a holder typed in their own `idHash` and `birthYear`, and the proof only showed they were internally consistent. Anyone could claim any age. Now a credential issuer signs the identity once, and every proof shows that signature privately.

## What the issuer signs

```
M = Poseidon("zq-cred/v1", idHash, birthYear, expiryDay)
```

The issuer signs `M` with EdDSA-Poseidon on BabyJubJub (the circomlib scheme, cheap to verify in a circuit). `expiryDay` counts whole days since 1970-01-01 UTC. `"zq-cred/v1"` is the ASCII string read as a field element (`578216463573960094610993`), so these signatures can't be confused with anything else the key might sign.

A credential is JSON (`src/zkp/credential.ts`):

```json
{
  "format": "zquent-credential/v1",
  "issuer": { "name": "ZQUENT Demo Issuer (not a real KYC provider)", "publicKey": ["<x>", "<y>"], "demo": true },
  "subject": { "idHash": "<decimal>", "birthYear": 1990, "expiryDay": 20764 },
  "signature": { "R8": ["<x>", "<y>"], "S": "<decimal>" }
}
```

The holder keeps it next to `idHash`, `salt` and `birthYear`. It never goes to the verifier.

## What the proof shows

Both circuits (`kyc_credential`, `kyc_reveal`) share `circuits/lib/credential.circom`, which proves:

1. `commitment == Poseidon(idHash, salt)`, which ties the proof to the agent.
2. The issuer at the public `issuerPubKey` signed `(idHash, birthYear, expiryDay)`.
3. `currentYear - birthYear >= minAge`, with range checks so the comparison can't wrap.
4. `currentDay <= expiryDay`.
5. `nullifier == Poseidon(idHash, nullifierScope, currentDay)`.

The server pins every public input. A proof is only meaningful for the inputs the verifier insists on:

| Public input | Pinned to |
|---|---|
| `issuerPubKey` | `ZQUENT_ISSUER_PUBLIC_KEY` (else derived from `ZQUENT_ISSUER_PRIVATE_KEY`) |
| `currentDay` | the day stored with the payment challenge (`src/policy/challenges.ts`) |
| `nullifierScope` | `NULLIFIER_SCOPE`, ASCII `"zq-daily/v1"` |
| `currentYear`, `minAge`, `txNonce`, `revealPubKey` | as before |

With no issuer configured, the server accepts no proofs (`POST /api/v1/payment` returns 503 when a proof would be needed).

### Public signals

`kyc_credential`:
`[nullifier, commitment, currentYear, minAge, txNonce, issuer.x, issuer.y, currentDay, nullifierScope]`

`kyc_reveal`:
`[R.x, R.y, c0, c1, c2, nullifier, commitment, currentYear, minAge, PK.x, PK.y, txNonce, issuer.x, issuer.y, currentDay, nullifierScope]`

The 402 challenge from `/api/v1/payment` now includes:

```json
"credential": { "issuerPublicKey": ["<x>", "<y>"], "currentDay": 20399, "nullifierScope": "148023414742210737297389105" }
```

## The daily nullifier

`Poseidon(idHash, scope, day)` is the same for one person all day, whichever agent or salt they use. `POST /api/v1/verify-proof` counts proof-approved spend against it. With `ZQUENT_PERSON_DAILY_LIMIT` (USD) set, it refuses a payment that would take one person over that total across all their agents. Unset, it still counts but doesn't cap.

What it costs in privacy: a person's proofs on the same day, on the same server, carry the same nullifier, so they can be linked to each other (not to the identity). A new day gives a new, unlinkable value. A different `nullifierScope` would give unlinkable values across deployments.

What it doesn't cover yet: payments **under** the anonymous threshold need no proof, so they carry no nullifier. One person running many agents at $999/day each is still possible. Closing that is the rest of P1.

## The demo issuer

`POST /api/v1/credentials/issue` with `{ idHash, birthYear }` returns a signed credential. It runs only when `ZQUENT_ISSUER_PRIVATE_KEY` is set. **It signs whatever it is sent**, so on this deployment the credential proves the flow works, not that anyone's age was checked. It's rate-limited per IP and stores nothing. The demo widget calls it the first time an identity needs to prove.

A real deployment sets only `ZQUENT_ISSUER_PUBLIC_KEY` to a KYC provider's key and leaves the private key unset. That turns the demo issuer off.

## Keys

```bash
npm run issuer -- keygen                    # prints both env lines
npm run issuer -- issue --id-hash 123 --birth-year 1990
npm run issuer -- check credential.json
```

Rotating the issuer key invalidates every outstanding credential. Holders get a new one (the demo widget does this automatically when the challenge names a different issuer).

## Limits

- One issuer key at a time. A set of accepted issuers would need a Merkle-root public input instead.
- No revocation list. Expiry is the only way a credential stops working.
- EdDSA on BabyJubJub and Groth16 are classical, not post-quantum. A quantum attacker could forge issuer signatures and proofs.
