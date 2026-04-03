/**
 * ZKX — ZK Circuit Setup Script
 *
 * Run this once after compiling the circuit to generate:
 *   1. Groth16 proving key (.zkey)
 *   2. Verification key (verification_key.json)
 *
 * Prerequisites:
 *   1. Install circom: https://docs.circom.io/getting-started/installation/
 *   2. Run: npm run compile-circuit
 *   3. Download the Powers of Tau ceremony file:
 *      wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O circuits/pot12_final.ptau
 *   4. Run: npm run setup-zk
 *
 * Output files are placed in public/zk/ so Next.js serves them to the browser.
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

const CIRCUIT_NAME = "kyc_credential";
const BUILD_DIR = path.join(__dirname, "../circuits/build");
const PUBLIC_ZK_DIR = path.join(__dirname, "../public/zk");
const PTAU_PATH = path.join(__dirname, "../circuits/pot12_final.ptau");

async function main() {
  fs.mkdirSync(PUBLIC_ZK_DIR, { recursive: true });

  const r1csPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
  const wasmPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm`);
  const zkey0Path = path.join(BUILD_DIR, `${CIRCUIT_NAME}_0.zkey`);
  const zkeyFinalPath = path.join(PUBLIC_ZK_DIR, `${CIRCUIT_NAME}_final.zkey`);
  const vkeyPath = path.join(PUBLIC_ZK_DIR, "verification_key.json");
  const wasmDest = path.join(PUBLIC_ZK_DIR, `${CIRCUIT_NAME}.wasm`);

  console.log("⚡ Setting up Groth16 proving system...");

  // Phase 2 setup
  await snarkjs.zKey.newZKey(r1csPath, PTAU_PATH, zkey0Path);
  console.log("✓ Phase 2 key generated");

  // Contribute randomness (in production: use a real MPC ceremony)
  await snarkjs.zKey.contribute(zkey0Path, zkeyFinalPath, "ZKX Demo Contributor", "zkx_entropy_2026");
  console.log("✓ Contribution complete");

  // Export verification key
  const vkey = await snarkjs.zKey.exportVerificationKey(zkeyFinalPath);
  fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
  console.log("✓ Verification key exported →", vkeyPath);

  // Copy wasm to public/zk/
  fs.copyFileSync(wasmPath, wasmDest);
  console.log("✓ Wasm copied →", wasmDest);

  console.log("\n✅ ZK setup complete. Run `npm run dev` to start.");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
