# Threshold Reveal — spec (`vero-reveal/v1`)

ROADMAP.md phase 2. This document defines the boundary an institution plugs into: the circuit
extension, the ciphertext format, and the threshold-decryption contract. Vero Protocol does not
run a consortium or hold keys.

## What each party learns

| Party | Learns |
|-------|--------|
| Verifier / server | Same as today: "credential valid, age ≥ 18", plus an opaque ciphertext it can't read. |
| Any single consortium member | Nothing. One partial decryption reveals nothing. |
| Any `k-1` members together | Nothing. |
| Any `k` members together | `idHash`, `birthYear`, `salt` for **one** ciphertext, checked against its commitment. Other ciphertexts stay sealed. |
| The platform operator | Nothing, unless it is also `k` consortium members. Don't set it up that way. |

Anonymous-tier payments (< $1,000/day) never produce a proof, so they never produce a ciphertext.

## Turning it on

```bash
npm run compile-circuit:reveal          # needs circom 2.x
npm run setup-zk:reveal                 # needs circuits/pot14_final.ptau — PSE ppot_0080_14 (see scripts/setup_zk.js)
npm run reveal -- keygen --threshold 2 --parties 3 --out ./consortium   # reference dealer only
export VERO_REVEAL_PUBLIC_KEY="<x>,<y>" # printed by keygen
```

With `VERO_REVEAL_PUBLIC_KEY` set:

- `POST /api/v1/payment` adds `challenge.reveal.publicKey` to its 402 response.
- The browser prover sees it and switches to `kyc_reveal`.
- `POST /api/v1/verify-proof` accepts **only** `kyc_reveal` proofs encrypted to that exact key.
  A plain `kyc_credential` proof, or one encrypted to any other key, is rejected.
- The ciphertext goes to the reveal escrow (`escrow:<txId>`, never trimmed). The approval's
  audit record gets only `revealEscrow: { format, ciphertextHash }`, so agents reading their
  own trail (`GET /api/v1/audit`) never receive the ciphertext.

Unset, nothing changes. A set-but-malformed key makes both routes error instead of quietly
turning reveal off.

## Cryptography

Curve: BabyJubJub (the curve circomlib uses for EdDSA), generator `Base8`, prime subgroup order `l`.
Hash: Poseidon over the BN254 scalar field `p`.

**Keys.** Consortium secret `sk ∈ [1, l)`, public `PK = sk·Base8`. `sk` is Shamir-shared over
`Z_l`: party `i` (1-indexed) holds `s_i = f(i)` for a random degree-`k-1` polynomial with
`f(0) = sk`, and publishes a verification key `Y_i = s_i·Base8`.

**Encryption (in the circuit).** For a fresh random nonce `r`:

```
R    = r·Base8
S    = r·PK
c[i] = m[i] + Poseidon(S.x, S.y, i)  mod p,   m = [idHash, birthYear, salt],  i = 0,1,2
```

The circuit also proves the existing statements: `commitment = Poseidon(idHash, salt)` and
`currentYear - birthYear ≥ minAge`. So the ciphertext provably contains the identity behind the
commitment the server already checks. It also checks that `PK` is on the curve.

**Partial decryption.** Party `i` publishes `D_i = s_i·R` and a Chaum-Pedersen proof that
`log_Base8(Y_i) = log_R(D_i)`: `(A1, A2, z)` with `A1 = w·Base8`, `A2 = w·R`,
`e = Poseidon(Y_i, R, D_i, A1, A2) mod l`, `z = w + e·s_i mod l`. A party that submits a wrong
`D_i` is identified by index.

**Combine.** For any `k` valid partials with indices `X`:
`S = Σ λ_i·D_i` where `λ_i = Π_{j∈X, j≠i} j/(j−i) mod l`. Then `m[i] = c[i] − Poseidon(S.x, S.y, i)`.
The result is accepted only if `Poseidon(idHash, salt)` equals the stored commitment.

## Public signals (`kyc_reveal`)

| Index | Signal | Kind |
|-------|--------|------|
| 0, 1 | `R.x`, `R.y` | output |
| 2, 3, 4 | `c[0]`, `c[1]`, `c[2]` | output |
| 5 | `commitment` | public input |
| 6 | `currentYear` | public input |
| 7 | `minAge` | public input |
| 8, 9 | `PK.x`, `PK.y` | public input |
| 10 | `txNonce` | public input |

`kyc_credential`: `[commitment, currentYear, minAge, txNonce]`.

`txNonce` is the single-use challenge from the 402 response (`src/policy/challenges.ts`). Every
approved KYC payment therefore has its own proof and its own fresh ciphertext, and the audit
record stores the nonce next to the ciphertext.

## Formats

All JSON, decimal strings for field elements, `"format": "vero-reveal/v1"`.

```jsonc
// RevealCiphertext — stored in the reveal escrow under its txId (src/policy/escrow.ts)
{ "format": "vero-reveal/v1", "commitment": "…", "publicKey": ["x","y"],
  "ephemeral": ["Rx","Ry"], "ciphertext": ["c0","c1","c2"] }

// ConsortiumKey — public
{ "format": "vero-reveal/v1", "threshold": 2, "parties": 3, "publicKey": ["x","y"],
  "verificationKeys": [{ "index": 1, "publicKey": ["x","y"] }, …] }

// KeyShare — secret, one per party
{ "format": "vero-reveal/v1", "index": 1, "share": "…", "consortiumPublicKey": ["x","y"] }

// PartialDecryption — safe to send to whoever combines
{ "format": "vero-reveal/v1", "index": 1, "partial": ["x","y"],
  "proof": { "a1": ["x","y"], "a2": ["x","y"], "z": "…" } }
```

## Post-quantum escrow (`vero-escrow/v2`)

The ElGamal ciphertext above is classical: anyone who copies it today could decrypt it with a
future quantum computer ("harvest now, decrypt later"). Identity data has to stay confidential
for years, so the server seals each ciphertext in a post-quantum envelope before storing it.

```
K            = random 256-bit AES key
body         = AES-256-GCM(K, inner ciphertext JSON, AAD = header)
s_1..s_n     = Shamir k-of-n split of K over GF(2^521 − 1)
share_i      = AES-256-GCM(HKDF(X-Wing.Encaps(ek_i).ss, txId, i), s_i, AAD = header)
header       = [format, txId, k, n, ciphertextHash, keySetId]
```

- **KEM:** X-Wing (ML-KEM-768 + X25519, `draft-connolly-cfrg-xwing-kem`), from
  `@noble/post-quantum`. It stays secure if either ML-KEM or X25519 holds.
- **No dealer:** each member generates their own X-Wing key and sends only the public half.
- **Binding:** every share and the body authenticate the header, so a share can't be moved to
  another transaction and the recorded `ciphertextHash` can't be swapped. After opening, the
  inner ciphertext is checked against that hash.
- **Two layers:** opening the envelope needs k members' X-Wing keys, and reading the identity
  still needs k ElGamal partials. A future quantum attacker who stole the store faces ML-KEM first.
- **What stays classical:** Groth16 proof soundness (BN254) and the BabyJubJub ElGamal layer.
  The server briefly holds K and the inner ciphertext at seal time.

Turn it on:

```bash
npm run reveal -- kem-keygen --index 1 --out ./member-1        # each member, own machine
npm run reveal -- escrow-keys --threshold 2 member-*.pub.json  # operator
export VERO_ESCROW_KEYS='{"format":"vero-escrow-keys/v1",…}'   # printed above
npm run reveal -- seal-pending                                 # seal records stored before this
```

Unset, ciphertexts are stored unsealed and the server logs a warning. A set-but-malformed value
makes `verify-proof` fail instead of storing unsealed.

```jsonc
// EscrowEnvelope — stored at escrow:<txId>, never trimmed
{ "format": "vero-escrow/v2", "txId": "…", "threshold": 2, "parties": 3,
  "ciphertextHash": "<sha256 hex>", "keySetId": "<sha256 hex>",
  "body": { "iv": "…", "data": "…" },
  "shares": [{ "index": 1, "kem": "<X-Wing ciphertext>", "iv": "…", "data": "…" }, …] }
```

## Disclosure round-trip (reference CLI)

```bash
npm run reveal -- escrow --tx zkx_123 --out env.json       # operator, reads the escrow store
npm run reveal -- unseal --member-key member-1.key.json --envelope env.json --out part-1.json  # member 1
npm run reveal -- unseal --member-key member-3.key.json --envelope env.json --out part-3.json  # member 3
npm run reveal -- open --envelope env.json --out ct.json part-1.json part-3.json
npm run reveal -- partial --share share-1.json --ciphertext ct.json --out p1.json   # party 1
npm run reveal -- partial --share share-3.json --ciphertext ct.json --out p3.json   # party 3
npm run reveal -- combine --consortium consortium.json --ciphertext ct.json p1.json p3.json
npm run reveal -- demo     # all of the above in memory
```

For unsealed records, `escrow` writes `ct.json` directly; skip `unseal` and `open`.

## What a production deployment replaces

- **`keygen`.** It uses a trusted dealer who briefly sees `sk`. Replace it with a DKG
  (Pedersen/Feldman) or an HSM ceremony that outputs the same `ConsortiumKey` / `KeyShare` shapes.
- **Share files.** Shares belong in each party's HSM/KMS. `partialDecrypt` is the one
  operation the HSM needs to expose.
- **Member X-Wing keys.** `member-<i>.key.json` belongs in an HSM; `unsealEscrowShare` is the
  one operation it needs to expose.
- **The trusted setup.** `setup-zk` makes a single-contributor Groth16 key. Run a real phase-2
  ceremony before trusting proofs in production.
- **Access to ciphertexts.** Today the only read path is the operator reading the escrow store.
  A regulator-facing request flow is next on the roadmap; the legal process around it is the
  institution's to build.

## Known limits

- Rotating the consortium key means a new `VERO_REVEAL_PUBLIC_KEY`. Old ciphertexts stay
  decryptable only by the old consortium. The same holds for `VERO_ESCROW_KEYS`.
- `@noble/post-quantum` is pure JavaScript: not independently audited, not constant-time, not
  FIPS-validated. Fine for a reference implementation; an institution would seal inside an HSM.
- Ciphertexts already handed out before the escrow split (through `GET /api/v1/audit`) can't
  be recalled.

## Challenge binding (`txNonce`)

`POST /api/v1/payment` answers a KYC-tier payment with a 402 whose `challenge` carries:

```jsonc
{ "currentYear": 2026, "minAge": 18, "commitment": "…",
  "txNonce": "…",                  // random field element, single use
  "expiresInSeconds": 600,
  "payment": { "amount": 1500, "recipient": "0x…" },   // what the nonce is bound to
  "reveal": { "publicKey": ["x","y"] } }               // only when reveal is on
```

`POST /api/v1/verify-proof` reads `txNonce` from the proof's public signals and atomically
deletes the stored challenge before verifying. It rejects the proof if the nonce is unknown,
expired, already used, issued to another agent, or if `amount`, `recipient` or `chainId` differ
from the challenged payment. A rejected attempt still spends the nonce, so the client has to
request a new challenge.
