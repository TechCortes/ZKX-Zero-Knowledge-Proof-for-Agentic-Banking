pragma circom 2.0.0;

include "lib/credential.circom";

/*
 * KYC Credential Circuit (v2: issuer-signed credential + daily nullifier)
 *
 * Proves the holder has an issuer-signed identity credential, is at least
 * minAge, the credential hasn't expired, and outputs a per-person daily
 * nullifier. All the checks live in lib/credential.circom.
 *
 * Private : idHash, birthYear, salt, expiryDay, sigR8[2], sigS
 * Public  : commitment, currentYear, minAge, txNonce, issuerPubKey[2],
 *           currentDay, nullifierScope
 * Output  : nullifier
 *
 * snarkjs publicSignals order (outputs first, then public inputs):
 *   [nullifier, commitment, currentYear, minAge, txNonce,
 *    issuer.x, issuer.y, currentDay, nullifierScope]
 */
template KYCCredential() {
    signal input idHash;
    signal input birthYear;
    signal input salt;
    signal input expiryDay;
    signal input sigR8[2];
    signal input sigS;

    signal input commitment;
    signal input currentYear;
    signal input minAge;
    signal input txNonce;
    signal input issuerPubKey[2];
    signal input currentDay;
    signal input nullifierScope;

    signal output nullifier;

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
}

component main {public [commitment, currentYear, minAge, txNonce, issuerPubKey, currentDay, nullifierScope]} = KYCCredential();
