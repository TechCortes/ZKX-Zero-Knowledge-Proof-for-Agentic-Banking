# Audit chain — spec (`vero-audit-checkpoint/v1`)

The audit log records every policy decision without personal data. This makes it
**tamper-evident**: after a checkpoint, nobody can change, remove or reorder a covered record
without breaking a hash or a signature, and the signatures stay unforgeable against a future
quantum computer.

## Records

Every record gets a global `seq` (Redis `INCR`) and is stored write-once at `audit_rec:<seq>`,
never trimmed. Each one carries:

```
recordHash = SHA-256( canonical JSON of the record without recordHash )
```

Canonical JSON means keys sorted at every level and no whitespace (`src/lib/canonicalJson.ts`).
Agents still see their own records through `GET /api/v1/audit` (capped view); those records
include `seq` and `recordHash`.

## Checkpoints

A checkpoint covers the next run of sequence numbers:

```
h_0       = previous checkpoint's chainHash   (64 zeros before checkpoint 1)
h_i       = SHA-256( h_{i-1} ‖ leaf_i )       leaf = recordHash, or SHA-256("void:<seq>")
chainHash = h_last
```

```jsonc
{ "format": "vero-audit-checkpoint/v1", "index": 7, "fromSeq": 1201, "toSeq": 1450,
  "voided": [], "prevChainHash": "…", "chainHash": "…", "createdAt": "…",
  "signature": { "suite": "ed25519+ml-dsa-65", "keyId": "…", "ed25519": "…", "mlDsa65": "…" } }
```

The signature covers the canonical JSON of everything except `signature`. **Both** halves must
verify: Ed25519 (classical) and ML-DSA-65 (FIPS 204, post-quantum). Forging a checkpoint means
breaking both.

**Gaps.** A writer takes a number, then stores its record. If it dies in between, the slot stays
empty, and a checkpoint stops there. If the same gap is still there 10 minutes later, the
checkpoint writes a write-once `void` marker into the slot. A late writer then can't fill it,
and retries with a new number.

## Running it

```bash
npm run audit -- keygen            # prints ZQUENT_AUDIT_SIGNING_KEY (secret) and the public key
# Vercel: set ZQUENT_AUDIT_SIGNING_KEY and CRON_SECRET. vercel.json runs the cron daily.
npm run audit -- checkpoint        # operator, on demand
npm run audit -- verify --url https://<deployment> --key audit-pub.json [--record record.json]
```

- `GET /api/v1/audit/checkpoints` is public: the latest 20 checkpoints and the public key.
- `GET /api/v1/audit/checkpoints?index=n` adds the leaf hashes for checkpoint n, so anyone holding
  a record can check that it is covered, unchanged. Hashes only: no record content, no agent ids.

## Limits

- **The key holder can rewrite history.** Whoever holds `ZQUENT_AUDIT_SIGNING_KEY` can sign a
  different chain. Publishing checkpoints makes that detectable by anyone who saved an earlier
  one. Anchoring each `chainHash` on-chain (planned) makes it detectable by everyone.
- **Records after the last checkpoint** are not yet protected. With a daily cron, that's up to a day.
- **Records written before the chain** have no `seq` and are not covered.
- **Library:** `@noble/post-quantum` is not audited and not constant-time. An institution would
  sign inside an HSM.
