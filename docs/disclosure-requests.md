# Disclosure requests — spec (`vero-disclosure-request/v1`)

How a regulator asks for **one** transaction to be unmasked, and how the consortium's
approvers agree to it. This step only authorises a disclosure. Decrypting and delivering
the identity is in `docs/disclosure-delivery.md` (D5).

Code: `src/disclosure/requests.ts` (formats and checks), `src/disclosure/store.ts`
(storage), routes under `src/app/api/v1/disclosure/`. CLI: `npm run disclosure -- <command>`
(`npm run disclosure -- demo` runs the whole flow in memory).

## Flow

1. The regulator hashes its legal document (court order, warrant, travel-rule request)
   with SHA3-256. The document itself never goes to the server.
2. It writes a request naming the transaction and signs it with the hybrid key
   (Ed25519 + ML-DSA-65) it has in the registry (`docs/key-registry.md`).
3. `POST /api/v1/disclosure/requests` checks the signature, looks up the transaction's
   escrowed ciphertext, and returns `requestHash` and `ciphertextHash`.
4. The regulator sends the approvers a bundle: the signed request, `ciphertextHash`,
   `requestHash`, and the legal document.
5. Each approver checks the regulator's signature, checks the document against
   `legalBasisHash`, recomputes `requestHash`, and only then signs it
   (`POST /api/v1/disclosure/requests/<requestHash>/approvals`).
6. Once `approvalThreshold` distinct registered approvers have signed before expiry, the
   request is `approved`.

## The request

```json
{
  "request": {
    "format": "vero-disclosure-request/v1",
    "consortiumId": "demo-consortium",
    "regulatorId": "demo-fiu",
    "txId": "…",
    "legalBasisHash": "<SHA3-256 of the legal document, 64 lowercase hex>",
    "issuedAt": "2026-11-04T12:00:00.000Z",
    "expiresAt": "2026-11-11T12:00:00.000Z",
    "nonce": "<32 random bytes, 64 lowercase hex>"
  },
  "signature": { "suite": "ed25519+ml-dsa-65", "keyId": "…", "ed25519": "…", "mlDsa65": "…" }
}
```

The regulator signs `SHA3-256("vero-disclosure-request/v1|submit|" ‖ canonicalJson(request))`.
Unknown fields are rejected. The server also rejects a request whose `issuedAt` is more than
5 minutes from server time, whose `expiresAt` has passed, or that stays open longer than
30 days. The signature is the only authentication: there is no API key.

## requestHash

```
requestHash = SHA3-256( LP("vero-disclosure-request/v1") ‖ LP(consortiumId) ‖ LP(regulatorId)
                        ‖ LP(txId) ‖ LP(ciphertextHash) ‖ LP(legalBasisHash) ‖ LP(expiresAt) ‖ LP(nonce) )
LP(s) = 4-byte big-endian length of UTF-8 s ‖ UTF-8 s
```

The length prefixes mean no two field lists hash the same bytes. Because the regulator,
transaction, escrowed ciphertext and legal basis are all inside it, an approval can't be
moved to another transaction or handed to another regulator. The nonce makes every request
distinct, and submitting the same request twice is refused (409).

## Approvals

Each approver signs `SHA3-256("vero-disclosure-approval/v1|" ‖ requestHash bytes)` and posts
`{ approverId, signature }`. The approver must be active in the registry (inside its validity
window and not revoked) when it signs. Each approver can approve once. `tallyApprovals`
re-checks every stored approval from scratch. Members run it themselves before they unseal
anything (D5), so they don't have to trust the server's `status`.

## API

| Route | Who | Returns |
|---|---|---|
| `POST /api/v1/disclosure/requests` | regulator | 201 summary + `ciphertextHash`; 401 bad signature, 403 unknown/inactive regulator, 404 no escrow for `txId`, 409 replay, 422 malformed, 429 daily limit |
| `GET /api/v1/disclosure/requests?limit=` | anyone | newest-first summaries (1..100, default 20) |
| `GET /api/v1/disclosure/requests/<requestHash>` | anyone | one summary |
| `POST /api/v1/disclosure/requests/<requestHash>/approvals` | approver | 201 summary; 401 bad signature/unknown approver, 404, 409 already approved, 410 expired |

Every route returns 503 when disclosure is off or not ready (too few active approvers, no
active regulator), and 500 when the registry is present but invalid or unpinned.

A summary is `{ requestHash, regulatorId, status, receivedAt, expiresAt, approvalThreshold,
approvals: [{ approverId, approvedAt }], deliveryThreshold, deliveries: [{ memberIndex,
deliveredAt }] }`, with `status` one of `pending`, `approved`, `delivered` (D5) or `expired`. It never includes `txId`, `ciphertextHash` or `legalBasisHash`. The agent can see
its own `ciphertextHash` in its audit trail, so any of these would let it recognise that it
is being investigated.

## Audit chain

Each submission, approval and the moment of approval is written to the audit chain
(`docs/audit-chain.md`) under the agent id `system:disclosure` (registered agent ids can't
contain `:`), with decisions `disclosure_requested`, `disclosure_approval` and
`disclosure_approved`. These records carry only the `requestHash` and the regulator or
approver id. Nothing is written to the investigated agent's own trail.

## Rate limit

Each regulator may submit `ZQUENT_DISCLOSURE_DAILY_LIMIT` requests per UTC day (default 10).
The slot is taken after the signature check, so nobody else can use up a regulator's quota,
and before the escrow lookup, so the limit also caps probing for transaction ids. Replays
and requests for unknown transactions still count.

## Configuration

| Variable | Meaning |
|---|---|
| `ZQUENT_REGISTRY_FILE` | Registry path (default `config/zquent-registry.json`). Disclosure is off when the file doesn't exist. |
| `ZQUENT_REGISTRY_MEMBERS_ID` | Required when the file exists. Pins the member set. |
| `ZQUENT_ESCROW_KEYS` | When set, the registry's member keys must match it. |
| `ZQUENT_DISCLOSURE_DAILY_LIMIT` | Requests per regulator per UTC day (default 10). |

The legacy `VERO_*` names are still read when the `ZQUENT_*` one is unset.

The `vero-disclosure-request/v1` and `vero-disclosure-approval/v1` tags keep their
pre-rename prefix on purpose: they are inside signed data, and changing them would
invalidate existing signatures. The same rule applies to the other wire formats.

## CLI

```
npm run disclosure -- request --registry registry.json --regulator-id demo-fiu --sign-key fiu/signing.key.json \
                              --tx-id <txId> --legal-doc order.pdf --out signed.json
npm run disclosure -- submit  --url https://host signed.json --out bundle.json
npm run disclosure -- check   --registry registry.json --legal-doc order.pdf bundle.json
npm run disclosure -- approve --registry registry.json --approver-id approver-1 --sign-key a1/signing.key.json \
                              --legal-doc order.pdf --url https://host bundle.json
npm run disclosure -- status  --url https://host <requestHash>
```

## Limits

- Approvers get the bundle and the legal document from the regulator out of band. The
  server doesn't store or relay either.
- The public log shows how many requests each regulator makes and when, but not what they
  are about.
- Approval is signatures only. A circuit that hides which approvers signed is optional
  later work (D7).
