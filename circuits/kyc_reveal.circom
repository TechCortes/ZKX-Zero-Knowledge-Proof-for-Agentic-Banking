pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";

/*
 * KYC Credential + Threshold Reveal Circuit (ROADMAP.md, phase 2)
 *
 * Everything kyc_credential.circom proves, plus: the private inputs are encrypted
 * to a consortium public key, and the proof guarantees the ciphertext really
 * contains them. The verifier still learns nothing about the identity. A
 * k-of-n consortium holding shares of the matching secret key can decrypt one
 * specific ciphertext under legal process. No single party can do it alone.
 *
 * Encryption (hybrid ElGamal on BabyJubJub, Poseidon as the stream cipher):
 *   R    = r * Base8                       (ephemeral key, published)
 *   S    = r * PK                          (shared secret, never published)
 *   c[i] = m[i] + Poseidon(S.x, S.y, i)    for m = [idHash, birthYear, salt]
 *
 * Decryption: S = sk * R, then m[i] = c[i] - Poseidon(S.x, S.y, i).
 * The threshold part lives entirely in how sk is held (Shamir shares). The
 * circuit only sees one public key. See docs/threshold-reveal.md.
 *
 * Private inputs : idHash, birthYear, salt, revealNonce (r)
 * Public inputs  : commitment, currentYear, minAge, revealPubKey[2]
 * Public outputs : revealEphemeral[2] (R), revealCiphertext[3] (c)
 *
 * snarkjs publicSignals order (outputs first, then public inputs):
 *   [R.x, R.y, c0, c1, c2, commitment, currentYear, minAge, PK.x, PK.y]
 */
template KYCReveal() {
    // --- Private inputs ---
    signal input idHash;
    signal input birthYear;
    signal input salt;
    signal input revealNonce;

    // --- Public inputs ---
    signal input commitment;
    signal input currentYear;
    signal input minAge;
    signal input revealPubKey[2];

    // --- Public outputs ---
    signal output revealEphemeral[2];
    signal output revealCiphertext[3];

    // --- 1. Commitment: commitment == Poseidon(idHash, salt) ---
    component hasher = Poseidon(2);
    hasher.inputs[0] <== idHash;
    hasher.inputs[1] <== salt;
    commitment === hasher.out;

    // --- 2. Age: currentYear - birthYear >= minAge ---
    signal age;
    age <== currentYear - birthYear;
    component ageCheck = GreaterEqThan(8);
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;

    // --- 3. Threshold reveal ---
    // The server pins revealPubKey to the configured consortium key. Checking it
    // is on the curve here stops a malformed key from producing junk ciphertext.
    component pkCheck = BabyCheck();
    pkCheck.x <== revealPubKey[0];
    pkCheck.y <== revealPubKey[1];

    // R = r * Base8
    component ephemeral = BabyPbk();
    ephemeral.in <== revealNonce;
    revealEphemeral[0] <== ephemeral.Ax;
    revealEphemeral[1] <== ephemeral.Ay;

    // S = r * PK
    component nonceBits = Num2Bits(253);
    nonceBits.in <== revealNonce;
    component shared = EscalarMulAny(253);
    for (var i = 0; i < 253; i++) {
        shared.e[i] <== nonceBits.out[i];
    }
    shared.p[0] <== revealPubKey[0];
    shared.p[1] <== revealPubKey[1];

    // c[i] = m[i] + Poseidon(S.x, S.y, i)
    signal plaintext[3];
    plaintext[0] <== idHash;
    plaintext[1] <== birthYear;
    plaintext[2] <== salt;

    component pad[3];
    for (var i = 0; i < 3; i++) {
        pad[i] = Poseidon(3);
        pad[i].inputs[0] <== shared.out[0];
        pad[i].inputs[1] <== shared.out[1];
        pad[i].inputs[2] <== i;
        revealCiphertext[i] <== plaintext[i] + pad[i].out;
    }
}

component main {public [commitment, currentYear, minAge, revealPubKey]} = KYCReveal();
