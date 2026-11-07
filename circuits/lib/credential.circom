pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";

/*
 * Issuer-signed KYC credential (plan item I1). Shared by kyc_credential.circom
 * and kyc_reveal.circom so both circuits check exactly the same things.
 *
 * An issuer (a KYC provider; in this repo a clearly labelled demo issuer, see
 * src/zkp/credential.ts) signs
 *
 *     M = Poseidon("zq-cred/v1", idHash, birthYear, expiryDay)
 *
 * with EdDSA-Poseidon on BabyJubJub. The holder keeps the signature private and
 * proves, without revealing any of it:
 *
 *   1. commitment == Poseidon(idHash, salt)             (ties the proof to an agent)
 *   2. the issuer at issuerPubKey signed (idHash, birthYear, expiryDay)
 *   3. currentYear - birthYear >= minAge
 *   4. currentDay <= expiryDay                          (credential not expired)
 *   5. nullifier == Poseidon(idHash, nullifierScope, currentDay)
 *
 * The nullifier is the same for one person on one day, whichever agent or salt
 * they use, so the server can cap spend per person per day (plan item P1). It
 * links that person's proofs within one day and one scope, and nothing more.
 *
 * The server pins every public input (issuerPubKey, currentYear, currentDay,
 * minAge, nullifierScope, txNonce). A Groth16 proof is only meaningful for the
 * public inputs the verifier insists on.
 */

// ASCII "zq-cred/v1" as a field element. Domain-separates credential messages.
function CREDENTIAL_TAG() { return 578216463573960094610993; }

template IssuerCredential() {
    // --- Private ---
    signal input idHash;
    signal input birthYear;
    signal input salt;
    signal input expiryDay;
    signal input sigR8[2];
    signal input sigS;

    // --- Public (pinned by the server) ---
    signal input commitment;
    signal input currentYear;
    signal input minAge;
    signal input txNonce;
    signal input issuerPubKey[2];
    signal input currentDay;
    signal input nullifierScope;

    signal output nullifier;

    // 1. Commitment
    component commit = Poseidon(2);
    commit.inputs[0] <== idHash;
    commit.inputs[1] <== salt;
    commitment === commit.out;

    // 2. Issuer signature over the credential message
    component msg = Poseidon(4);
    msg.inputs[0] <== CREDENTIAL_TAG();
    msg.inputs[1] <== idHash;
    msg.inputs[2] <== birthYear;
    msg.inputs[3] <== expiryDay;

    // circomlib's verifier doesn't check R8 is on the curve. Do it here.
    component r8Check = BabyCheck();
    r8Check.x <== sigR8[0];
    r8Check.y <== sigR8[1];

    component sig = EdDSAPoseidonVerifier();
    sig.enabled <== 1;
    sig.Ax <== issuerPubKey[0];
    sig.Ay <== issuerPubKey[1];
    sig.S <== sigS;
    sig.R8x <== sigR8[0];
    sig.R8y <== sigR8[1];
    sig.M <== msg.out;

    // 3. Age. Range-check birthYear and currentYear so the 8-bit comparison
    // can't wrap: both must fit in 16 bits, and age in 8.
    component yearBits = Num2Bits(16);
    yearBits.in <== currentYear;
    component birthBits = Num2Bits(16);
    birthBits.in <== birthYear;
    signal age;
    age <== currentYear - birthYear;
    component ageBits = Num2Bits(8);
    ageBits.in <== age;
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;

    // 4. Expiry. Days since 1970-01-01 fit easily in 32 bits.
    component expiryBits = Num2Bits(32);
    expiryBits.in <== expiryDay;
    component dayBits = Num2Bits(32);
    dayBits.in <== currentDay;
    component notExpired = LessEqThan(32);
    notExpired.in[0] <== currentDay;
    notExpired.in[1] <== expiryDay;
    notExpired.out === 1;

    // 5. Per-person daily nullifier
    component nullHash = Poseidon(3);
    nullHash.inputs[0] <== idHash;
    nullHash.inputs[1] <== nullifierScope;
    nullHash.inputs[2] <== currentDay;
    nullifier <== nullHash.out;

    // txNonce has no other constraint; squaring it stops it being optimized
    // away, which would let a proof be replayed under a different nonce.
    signal txNonceSquared;
    txNonceSquared <== txNonce * txNonce;
}
