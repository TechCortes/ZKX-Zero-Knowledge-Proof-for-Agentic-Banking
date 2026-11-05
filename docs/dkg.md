# Distributed key generation — spec (`vero-dkg/v1`)

How the consortium makes its threshold-reveal key **without a trusted dealer**. Before this,
`npm run reveal -- keygen` dealt the key from one machine, which saw the whole secret key for
a moment. With the DKG, the secret key exists only as the sum of every member's random
contribution. No machine ever holds it.

Code: `src/zkp/dkg.ts`. CLI: `npm run dkg -- <command>` (`npm run dkg -- demo` runs a 2-of-3
ceremony in memory and decrypts with the result).

The outputs have the same shapes as the dealer's (`ConsortiumKey`, `KeyShare`), so the
proofs, `partialDecrypt`, `combinePartials` and the disclosure delivery (D5) don't change.

## Protocol (Joint-Feldman)

All arithmetic is in the BabyJubJub prime subgroup (order l, generator B = Base8). There
are n members with registry indices 1..n, and threshold k = the registry's `threshold`.

1. **Session.** A public document fixes `consortiumId`, k, n, every member's signing `keyId`
   and a random 32-byte nonce. `sessionId = SHA3-256("vero-dkg/v1|session|" ‖ canonicalJson(session))`.
   Anyone can create it; every member checks it against the registry.
2. **Deal.** Member i picks random a_i0..a_i(k−1) and publishes
   - Feldman commitments `C_ik = a_ik · B` (k points), and
   - `f_i(j) = Σ_k a_ik · j^k`, sealed to each other member j's X-Wing key (sealed box,
     context `vero-dkg/v1|share|<sessionId>|<i>|<j>`).

   The deal is signed with i's registry signing key. i keeps f_i(i) in a secret file until
   finalize.
3. **Finalize.** Member j opens every share sealed to it and checks it against its dealer's
   commitments: `f_i(j) · B == Σ_k C_ik · j^k`. If any share fails, finalize refuses and
   names the dealer. Otherwise:
   - `s_j = Σ_i f_i(j)`, j's key share (secret)
   - `PK = Σ_i C_i0`, the consortium public key
   - `Y_m = Σ_i Σ_k C_ik · m^k` for every member m, the verification keys

   PK and every Y_m come from public commitments, so every member computes the same values.
   j checks `s_j · B == Y_j` and signs a result naming PK and SHA3-256 of the Y_m list.
4. **Verify.** Anyone holding the transcript (session, n deals, n results) checks every
   signature, recomputes PK and every Y_m, and checks that every member signed those same
   values (`verifyDkgTranscript`).

## Running a ceremony

Each member works on their own machine. Only `session.json`, `deal-<i>.json` and
`result-<i>.json` travel between members, by any channel; all three are public.

```bash
npm run dkg -- session --registry registry.json --out session.json               # anyone
npm run dkg -- deal --registry registry.json --session session.json --member 1 \
    --sign-key m1/signing.key.json --out-dir m1                                    # each member
npm run dkg -- finalize --registry registry.json --session session.json --member 1 \
    --sign-key m1/signing.key.json --escrow-key member-1.key.json \
    --secret m1/dkg-secret-1.json --out-dir m1 deal-1.json deal-2.json deal-3.json # each member
npm run dkg -- verify --registry registry.json --session session.json \
    --out consortium.json deal-*.json result-*.json                                # anyone
```

Then:

1. Set `ZQUENT_REVEAL_PUBLIC_KEY` to the public key printed by `verify`.
2. Each member adds its reveal key to its registry entry
   (`npm run registry -- member … --consortium consortium.json`). The D5 delivery rebuilds
   the consortium key from these and checks they're consistent.
3. Each member keeps `share-<i>.json` (in an HSM in production) and deletes
   `dkg-secret-<i>.json`.
4. Publish the transcript next to the registry, so anyone can check where the key came from.

Members use their registry signing key to sign, and their X-Wing escrow key
(`npm run reveal -- kem-keygen`) to receive shares. The ceremony needs no new keys.

## What v1 doesn't do

- **No complaint round.** If a share doesn't match its commitments, or a member never deals,
  the ceremony stops and restarts with a new session, without the faulty member if needed.
  Every member must deal. A complaint-and-reveal round (Pedersen/GJKR) would let the others
  finish without restarting.
- **Key bias.** In Joint-Feldman, a member who deals last can choose to abort after seeing
  the others' commitments, which slightly biases PK (Gennaro, Jarecki, Krawczyk, Rabin). For
  threshold ElGamal decryption this is known not to break security (GJKR, "Secure Applications
  of Pedersen's Distributed Key Generation Protocol"). A fully uniform key needs the Pedersen
  VSS variant.
- **Classical.** The reveal key is BabyJubJub, which a quantum computer could break. The DKG
  shares themselves travel in X-Wing sealed boxes, and identities in the escrow stay under the
  post-quantum envelope.
- **Not audited.** Like the rest of the reveal code, this is a reference implementation.
