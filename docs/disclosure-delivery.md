# Disclosure delivery — spec (`vero-disclosure-delivery/v1`)

What happens after a disclosure request is approved (`docs/disclosure-requests.md`). The
consortium members unlock the identity for **one** transaction and hand it to the regulator
that asked. Neither the server nor any single member ever holds the plaintext identity, and
every step leaves a signed, hash-only record in the audit chain.

Code: `src/disclosure/delivery.ts` (protocol, pure functions), `src/disclosure/sealedBox.ts`,
`src/disclosure/store.ts`, routes under `src/app/api/v1/disclosure/requests/<requestHash>/`.
CLI: `npm run disclosure -- release | deliver | receive`. `npm run disclosure -- demo` runs
the whole flow in memory, from escrow to decrypted identity.

## Why two layers need two rounds

Each identity is protected twice (`docs/threshold-reveal.md`):

1. **Inner, classical:** ElGamal on BabyJubJub, encrypted inside the ZK proof to the
   consortium key. Decrypting needs k partial decryptions `D_i = s_i · R`.
2. **Outer, post-quantum:** the `vero-escrow/v2` envelope. AES-256-GCM, with the key split
   k-of-n and each share sealed to one member's X-Wing key.

A member can only compute `D_i` after the envelope is open, and opening it needs k members'
shares. So members first pass their envelope shares to each other (round 1), then each
delivers its partial to the regulator (round 2).

## Flow

| Step | Who | What |
|---|---|---|
| 0 | regulator, approvers | Request submitted and approved (D4). |
| 1. Package | each member | `GET …/package` returns the signed request, the approvals and the sealed envelope. The member re-checks the regulator's signature, recomputes `requestHash`, re-tallies the approvals and checks that the envelope's `ciphertextHash` is the one bound into `requestHash` (`verifyPackage`). |
| 2. Release | each member | Unseals its envelope share with its own X-Wing key and seals it separately to every other member (`releaseShare`). Signed, then `POST …/shares`. |
| 3. Deliver | each member | Opens the envelope with its own share plus k−1 released to it (`openForMember`), checks the inner ciphertext hashes to `ciphertextHash`, computes `D_i` with a Chaum-Pedersen proof, seals `{ ciphertext, partial }` to the regulator's X-Wing key and signs a receipt (`prepareDelivery`). Then `POST …/deliveries`. |
| 4. Receive | regulator | `GET …/deliveries`, then on its own machine (`openDisclosure`): checks each receipt, opens each box, checks that every member delivered the same ciphertext and that it matches `ciphertextHash`, verifies every partial's proof against the registered reveal keys, combines k partials and checks `Poseidon(idHash, salt) = commitment`. Only then is the identity returned. |

The result is the minimum the escrow holds: `txId`, `idHash`, `birthYear` and `salt` (the
salt is needed to check the commitment).

## Formats

**Sealed box** (`vero-sealed-box/v1`), for share releases and deliveries:

```
(kem, ss) = X-Wing.Encaps(recipient public key)
key       = HKDF-SHA256(ss, info = "vero-sealed-box/v1|" ‖ context)
data      = AES-256-GCM(key, message, AAD = context)
```

The context names the request, sender and recipient, so a box can't be reused anywhere else:

- share part: `vero-disclosure-share/v1|<requestHash>|<from>|<to>`
- delivery: `vero-disclosure-delivery/v1|<requestHash>|<member>|<regulatorId>`

**Share release** — `{ requestHash, from, boxes: [{ to, box }], signature }`. The signature
is by the member's registry signing key over
`SHA3-256("vero-disclosure-share/v1|" ‖ canonicalJson({ requestHash, from, boxes }))`.
A release must reach at least k−1 other members.

**Delivery** — `{ requestHash, index, box, signature }`. The box holds
`{ format, requestHash, txId, index, ciphertext, partial }`. The signature is the receipt:

```
SHA3-256("vero-disclosure-delivery/v1|receipt|" ‖ canonicalJson({ requestHash, index, ciphertextHash, deliveryHash }))
deliveryHash = SHA3-256(canonicalJson(box))
```

**The consortium key** is rebuilt from the members' registered reveal keys
(`PK = Σ λ_i · Y_i`, `consortiumKeyFromVerificationKeys`). Every window of k keys must give
the same PK, so a wrong key in the registry is caught. Members and the regulator need no
copy of `consortium.json`.

## Reading package, shares and deliveries

Reads are authenticated with a signed access token: `Authorization: ZQ-Sig <base64url>`.

```
token  = { party: "member" | "regulator", id, requestHash, action, issuedAt, signature }
digest = SHA3-256("vero-disclosure-access/v1|" ‖ canonicalJson({ party, id, requestHash, action, issuedAt }))
```

Members sign with their registry signing key (`id` is the member index). Only the regulator
that made the request can read `deliveries`. Tokens are accepted for 5 minutes either side
of server time. A token names one request and one action, so it can't be reused elsewhere.

## API

All under `/api/v1/disclosure/requests/<requestHash>/`. Each needs the request to be
approved (409 otherwise) and not expired (410). The one exception: the regulator can still
collect deliveries after expiry.

| Route | Who | Returns |
|---|---|---|
| `GET package` | member token | the package; 401 bad token |
| `POST shares` | member (signed body) | 201; 401 bad signature, 409 already released, 422 malformed |
| `GET shares` | member token | every release so far (each member can open only the boxes sealed to it) |
| `POST deliveries` | member (signed receipt) | 201 + public summary; 401 bad receipt, 409 already delivered, 422 malformed |
| `GET deliveries` | regulator token | the sealed deliveries |

The public summary (`GET /api/v1/disclosure/requests/<requestHash>`) gains
`deliveryThreshold` and `deliveries: [{ memberIndex, deliveredAt }]`. Its `status` becomes
`delivered` once k members have delivered.

## Audit chain

Two new decisions under `system:disclosure`: `disclosure_share_released`
(`{ requestHash, memberIndex }`) and `disclosure_delivered`
(`{ requestHash, memberIndex, deliveryHash }`). They carry no txId and no ciphertext.

## CLI

```
# each member, once the request is approved
npm run disclosure -- release --url https://host --registry registry.json --member 1 \
    --sign-key m1/signing.key.json --escrow-key member-1.key.json <requestHash>
# each member, once k members have released
npm run disclosure -- deliver --url https://host --registry registry.json --member 1 \
    --sign-key m1/signing.key.json --escrow-key member-1.key.json --reveal-share share-1.json <requestHash>
# the regulator, with the bundle from `submit`
npm run disclosure -- receive --url https://host --registry registry.json \
    --sign-key fiu/signing.key.json --kem-key fiu/kem.key.json bundle.json --out identity.json
```

Every member command re-checks the package and stops with a reason before releasing anything.

## Limits

- **Key ceremony.** Use the DKG (`npm run dkg`, `docs/dkg.md`) for the reveal key shares.
  With the reference dealer (`npm run reveal -- keygen`), one machine saw the whole key.
- **Members see the inner ciphertext.** Any k members could decrypt together at any time;
  the protocol makes doing so visible and accountable, it doesn't make it impossible.
- **No regulator acknowledgement yet.** The chain records what was delivered, not that the
  regulator opened it.
- **Not audited.** `@noble/post-quantum` is pure JavaScript, not constant-time and not
  FIPS-validated. An institution would run unseal, partial and open inside an HSM.
- **Wire tags.** The new tags use the same `vero-` prefix as the rest of the disclosure
  protocol, so one protocol has one prefix. They are pinned in the frozen-formats test.
