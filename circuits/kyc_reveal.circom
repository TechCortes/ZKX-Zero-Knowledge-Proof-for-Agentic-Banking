pragma circom 2.0.0;

include "lib/credential.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";

/*
 * KYC Credential + Threshold Reveal Circuit (v2: issuer-signed credential + daily nullifier)
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
 * The credential checks (issuer signature, age, expiry, nullifier, commitment)
 * are shared with kyc_credential.circom via lib/credential.circom.
 *
 * Private inputs : idHash, birthYear, salt, expiryDay, sigR8[2], sigS, revealNonce (r)
 * Public inputs  : commitment, currentYear, minAge, revealPubKey[2], txNonce,
 *                  issuerPubKey[2], currentDay, nullifierScope
 * Public outputs : revealEphemeral[2] (R), revealCiphertext[3] (c), nullifier
 *
 * snarkjs publicSignals order (outputs first, then public inputs):
 *   [R.x, R.y, c0, c1, c2, nullifier, commitment, currentYear, minAge, PK.x, PK.y,
 *    txNonce, issuer.x, issuer.y, currentDay, nullifierScope]
 *
 * txNonce is the server's single-use challenge for one payment (see
 * src/policy/challenges.ts), so each proof, and its ciphertext, is tied to it.
 */
template KYCReveal() {
    // --- Private inputs ---
    signal input idHash;
    signal input birthYear;
    signal input salt;
    signal input expiryDay;
    signal input sigR8[2];
    signal input sigS;
    signal input revealNonce;

    // --- Public inputs ---
    signal input commitment;
    signal input currentYear;
    signal input minAge;
    signal input revealPubKey[2];
    signal input txNonce;
    signal input issuerPubKey[2];
    signal input currentDay;
    signal input nullifierScope;

    // --- Public outputs ---
    signal output revealEphemeral[2];
    signal output revealCiphertext[3];
    signal output nullifier;

    // --- 1. Credential: commitment, issuer signature, age, expiry, nullifier, txNonce ---
    component cred = IssuerCredential();
    cred.idHash <== idHash;
    cred.birthYear <== birthYear;
    cred.salt <== salt;
    cred.expiryDay <== expiryDay;
    cred.sigR8 <== sigR8;
    cred.sigS <== sigS;
    cred.commitment <== commitment;
    cred.currentYear <== currentYear;
    cred.minAge <== minAge;
    cred.txNonce <== txNonce;
    cred.issuerPubKey <== issuerPubKey;
    cred.currentDay <== currentDay;
    cred.nullifierScope <== nullifierScope;
    nullifier <== cred.nullifier;

    // --- 2. Threshold reveal ---
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

component main {public [commitment, currentYear, minAge, revealPubKey, txNonce, issuerPubKey, currentDay, nullifierScope]} = KYCReveal();
