pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/*
 * KYC Credential Circuit
 *
 * Proves that the holder has a valid identity credential satisfying:
 *   1. The credential commits to their identity (Poseidon hash)
 *   2. Their age >= minAge (e.g., 18)
 *
 * Private inputs (never revealed):
 *   - idHash    : Poseidon hash of the user's government ID number
 *   - birthYear : Year of birth
 *   - salt      : Random blinding factor
 *
 * Public inputs (visible to verifier):
 *   - commitment  : Poseidon(idHash, salt) — ties proof to a specific credential
 *   - currentYear : Year the proof is generated
 *   - minAge      : Minimum age required (typically 18)
 */
template KYCCredential() {
    // --- Private inputs ---
    signal input idHash;
    signal input birthYear;
    signal input salt;

    // --- Public inputs ---
    signal input commitment;
    signal input currentYear;
    signal input minAge;

    // --- Verify commitment: commitment == Poseidon(idHash, salt) ---
    component hasher = Poseidon(2);
    hasher.inputs[0] <== idHash;
    hasher.inputs[1] <== salt;
    commitment === hasher.out;

    // --- Verify age: currentYear - birthYear >= minAge ---
    signal age;
    age <== currentYear - birthYear;

    component ageCheck = GreaterEqThan(8); // 8-bit comparison (max 255 years)
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;
}

component main {public [commitment, currentYear, minAge]} = KYCCredential();
