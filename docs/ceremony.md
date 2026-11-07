# Trusted-setup ceremony

Plan item **D6 part 2**. Replaces the single "Demo Contributor" in `scripts/setup_zk.js`.

## Why

Groth16 needs a per-circuit proving key made in two phases. Phase 1 (Powers of Tau) is shared: we use the PSE Perpetual Powers of Tau, `ppot_0080_14.ptau`, which had many independent contributors. Phase 2 is specific to our circuit. Whoever knows all the phase-2 randomness ("toxic waste") can forge proofs that verify.

With one contributor, that's the operator. With several contributors in a chain, an attacker needs the randomness of **every** contributor, so the key is sound if any one of them destroyed theirs. A public random beacon at the end means even the last contributor can't steer the result.

## What's committed

| File | What |
|---|---|
| `public/zk/<circuit>_final.zkey` | the proving key |
| `public/zk/<vkey>.json` | verification key exported from it |
| `public/zk/<circuit>.wasm` | witness generator |
| `ceremony/<circuit>.json` | transcript: compiler, r1cs hash, Powers of Tau hash, each contribution's name and hash, the beacon, hashes of the three files above |

Intermediate zkeys live in `circuits/build/ceremony/` and aren't committed. They aren't needed to check the result: the final zkey carries the whole contribution chain.

## Checking it

Anyone can run this, and CI runs it on every push:

```bash
npm run compile-circuit && npm run compile-circuit:reveal     # circom 2.2.2, --O2
wget https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_14.ptau -O circuits/pot14_final.ptau
npm run ceremony -- verify kyc_credential
npm run ceremony -- verify kyc_reveal
```

`verify` recompiles nothing itself. It checks that your compiled r1cs matches the transcript, runs snarkjs's full `zkey verify` against the r1cs and the Powers of Tau, and compares the zkey's contribution chain, name by name and hash by hash, with the transcript. Each contributor should also check that **their own** hash appears.

## Current state: demo ceremony

The committed keys come from `npm run ceremony -- demo`: three contributions labelled "Demo contributor A/B/C", then a drand beacon. One operator ran all three on one machine, so this proves the tooling and nothing more. The transcripts say `"demo": true`, and `verify` prints a warning. The drand round was taken at run time, not announced in advance.

## Running the real one

You need at least three contributors who don't trust each other (for example, three consortium members and an outside party) and about an hour each, mostly waiting.

**1. Coordinator: start.** On a clean checkout of the commit that freezes the circuits:

```bash
npm run compile-circuit && npm run compile-circuit:reveal
npm run ceremony -- init kyc_credential
npm run ceremony -- init kyc_reveal
```

Publish the commit hash and the `r1csSha256` from both transcripts.

**2. Each contributor, in turn.** The coordinator sends the latest zkey (`circuits/build/ceremony/<circuit>/NNNN.zkey`). The contributor, on their own machine and checkout:

```bash
npm run ceremony -- contribute kyc_reveal --name "Alice, Example Bank" \
  --in 0001.zkey --out alice.zkey --entropy "<mash the keyboard>"
```

System randomness is always mixed in; `--entropy` adds to it. The contributor publishes the printed hash somewhere the coordinator doesn't control (a signed post, an issue comment), sends `alice.zkey` back, and closes the terminal. Air-gapped machines and wiping the disk afterwards are optional extra care.

**3. Coordinator: accept each one.**

```bash
npm run ceremony -- accept kyc_reveal alice.zkey
```

This refuses a zkey that doesn't verify or wasn't built on the latest one. Repeat steps 2 and 3 for both circuits and every contributor.

**4. Beacon.** Before the last contribution, announce a future drand round, for example "drand quicknet round N, about 2 hours from now". Once it's published:

```bash
npm run ceremony -- beacon kyc_reveal --source "drand quicknet round N" --value <randomness hex>
```

Without `--demo`, it refuses until there are three contributions.

**5. Finalize and commit.**

```bash
npm run ceremony -- finalize kyc_credential
npm run ceremony -- finalize kyc_reveal
```

Commit `public/zk/` and `ceremony/`. CI re-verifies everything. Changing either circuit afterwards means a new ceremony.

## Limits

- Groth16 on BN254 is not post-quantum. A ceremony doesn't change that.
- Ceremony security also depends on snarkjs being correct. The circuits haven't been audited.
- `--O2` changes the r1cs, so the compiler flags are part of what the transcript pins.
