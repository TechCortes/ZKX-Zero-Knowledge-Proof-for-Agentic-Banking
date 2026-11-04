# Consortium key registry — spec (`vero-registry/v1`)

The disclosure flow needs a public answer to three questions: who holds the escrow, who
may approve a disclosure, and who may ask for one. The registry is one public JSON
document that answers all three. Every entry in it is signed, so a server, a member or an
outside auditor can check it offline.

Code: `src/disclosure/keyRegistry.ts`. CLI: `npm run registry -- <command>`
(`npm run registry -- demo` runs everything in memory).

## Contents

| Section | Each entry holds | Added by |
|---|---|---|
| `members` | index, name, X-Wing escrow key (same key as `VERO_ESCROW_KEYS`), hybrid signing key, optional BabyJubJub reveal key `Y_i` | `init` (the trust root) |
| `approvers` | id, name, role, hybrid signing key, validity window | self-signed proposal + **k member endorsements** |
| `regulators` | id, name, jurisdiction, hybrid signing key (authenticates requests), X-Wing key (receives the sealed result), validity window | self-signed proposal + **k member endorsements** |
| `revocations` | kind, id, keyId, `revokedAt`, reason | **k member endorsements** |

`threshold` (k) is the number of member endorsements an entry needs, and equals the escrow
threshold. `approvalThreshold` is the number of distinct approvers that must sign a
disclosure request (D4).

Hybrid signing key = Ed25519 + ML-DSA-65 (FIPS 204), same suite as audit checkpoints
(`docs/audit-chain.md`). A signature is valid only if **both** halves verify.

## What is signed

```
digest = SHA3-256( "vero-registry/v1|" ‖ kind ‖ "|" ‖ canonicalJson({ consortiumId, entry }) )
```

`kind` is `member`, `approver`, `regulator` or `revocation`; `entry` is the entry without its
`proof` and `endorsements`. Because the kind and the consortiumId are inside the digest, a
signature can't be moved to another entry, another kind or another consortium.

Each member, approver and regulator entry carries `proof`, its own signature over the
digest. This proves the party holds the key, so nobody can register someone else's key
under a different name. Endorsements are member signatures over the same digest.

## Rules checked by `verifyRegistry`

- Member indices are 1..n, each used once. Keys are well formed, and no two members share
  an X-Wing key.
- No two parties share a signing key. One exception: an approver may reuse its own member key.
- Every approver, regulator and revocation has at least k valid endorsements from distinct
  members. An invalid or duplicate endorsement is an error. It is not silently skipped.
- Ids are unique and lowercase (`[a-z0-9._-]`, max 64). Timestamps are ISO 8601 UTC.
- A revocation names the revoked entry's `keyId`, so re-registering a new key under the
  same id is not revoked by accident.
- Optional cross-checks: the members' X-Wing keys and threshold equal `VERO_ESCROW_KEYS`,
  the reveal keys equal `consortium.json`, and the member set equals a pinned `membersId`.

`disclosureReadiness` reports separately whether there are enough active approvers and at
least one active regulator. A registry can be valid without being ready.

## Pinning

- `membersId` = SHA3-256 over consortiumId, both thresholds and the member entries. It
  doesn't change when approvers or regulators are added. Pin it (`VERO_REGISTRY_MEMBERS_ID`)
  so the server only trusts a registry rooted in the agreed members.
- `registryId` = SHA3-256 over the whole document. Publish it to freeze a specific version.

Changing the members (adding, removing or rotating a member key) makes a new registry with
a new `membersId`, and every deployment must pin it again. That is deliberate: the member set
is the root of trust, and changing it should be a visible deployment change.

The registry is meant to be committed to the repo or published at a fixed URL, not stored
in an environment variable. The post-quantum keys and signatures make it large (about
55 KB for 3 members and one regulator), and a commit history is a public change log.

## Workflow

```bash
# every party, on their own machine
npm run reveal   -- kem-keygen --index 1 --out ./m1          # members: X-Wing escrow key
npm run registry -- keygen --out ./m1                        # everyone: signing key
npm run registry -- keygen --out ./fiu --with-kem            # regulators also need an X-Wing key

# each member makes a self-signed entry; one of them assembles the registry
npm run registry -- member --consortium-id demo --index 1 --name "Bank A" \
  --kem ./m1/member-1.pub.json --sign-key ./m1/signing.key.json \
  --consortium consortium.json --out m1.json
npm run registry -- init --consortium-id demo --threshold 2 --approval-threshold 2 \
  --out registry.json m1.json m2.json m3.json

# a regulator proposes itself; k members endorse; anyone adds it
npm run registry -- regulator --registry registry.json --id demo-fiu --name "Demo FIU" \
  --jurisdiction XX --sign-key ./fiu/signing.key.json --kem-key ./fiu/kem.pub.json --out fiu.json
npm run registry -- endorse --registry registry.json --index 1 --sign-key ./m1/signing.key.json fiu.json
npm run registry -- endorse --registry registry.json --index 3 --sign-key ./m3/signing.key.json fiu.json
npm run registry -- add --registry registry.json fiu.json

npm run registry -- verify --registry registry.json --consortium consortium.json
```

Approvers use `approver` the same way. `revoke` makes a revocation proposal, which
members endorse and then `add`.

## Limits

- Reference tooling: keys are JSON files. In production each party signs inside an HSM,
  and only the signatures travel.
- `@noble/post-quantum` is not independently audited and not constant-time. Nothing here
  is FIPS-validated.
- The registry says who may act. It doesn't check that a regulator's legal authority is
  real. Members must check that before they endorse.
- Not wired into the server yet. D4 (`POST /api/v1/disclosure/requests`) loads it,
  authenticates requests against `regulators`, and checks approvals against `approvers`.
