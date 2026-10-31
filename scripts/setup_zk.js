/**
 * Vero Protocol — ZK Circuit Setup Script
 *
 * Run this once after compiling a circuit to generate:
 *   1. Groth16 proving key (.zkey)
 *   2. Verification key (.json)
 *
 * Usage:
 *   node scripts/setup_zk.js [circuit] [--ptau <file>] [--local-ptau <power>]
 *
 *   circuit       kyc_credential (default) or kyc_reveal
 *   --ptau        Powers of Tau file. Default: circuits/pot14_final.ptau (big enough
 *                 for both circuits).
 *   --local-ptau  Generate a throwaway Powers of Tau of size 2^power locally instead
 *                 of downloading one. DEV ONLY: a single-contributor ceremony gives no
 *                 security. Use the Hermez/PSE files for anything real.
 *
 * Prerequisites:
 *   1. Install circom: https://docs.circom.io/getting-started/installation/
 *   2. Compile: npm run compile-circuit (or compile-circuit:reveal)
 *   3. Download a Powers of Tau file large enough for the circuit (the Hermez
 *      buckets are gone; PSE Perpetual Powers of Tau is the maintained successor):
 *        kyc_credential (~530 constraints)  → pot10+  (pot14 works too)
 *        kyc_reveal     (~9k constraints)   → pot14
 *      wget https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_14.ptau -O circuits/pot14_final.ptau
 *   4. Run: npm run setup-zk (or setup-zk:reveal)
 *
 * Output files are placed in public/zk/ so Next.js serves them to the browser.
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CIRCUITS = {
  kyc_credential: { ptau: "pot14_final.ptau", vkey: "verification_key.json" },
  kyc_reveal: { ptau: "pot14_final.ptau", vkey: "kyc_reveal_verification_key.json" },
};

function parseArgs(argv) {
  const args = { circuit: "kyc_credential", ptau: null, localPtau: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ptau") args.ptau = argv[++i];
    else if (argv[i] === "--local-ptau") args.localPtau = Number(argv[++i]);
    else args.circuit = argv[i];
  }
  if (!CIRCUITS[args.circuit]) {
    throw new Error(`Unknown circuit "${args.circuit}". Use one of: ${Object.keys(CIRCUITS).join(", ")}`);
  }
  if (args.localPtau !== null && !(args.localPtau >= 8 && args.localPtau <= 20)) {
    throw new Error("--local-ptau expects a power between 8 and 20.");
  }
  return args;
}

const ROOT = path.join(__dirname, "..");
const BUILD_DIR = path.join(ROOT, "circuits/build");
const PUBLIC_ZK_DIR = path.join(ROOT, "public/zk");

/** Single-contributor Powers of Tau. Fine for local dev, worthless as a security ceremony. */
async function makeLocalPtau(power, outPath) {
  console.log(`⚠ Generating a LOCAL, dev-only Powers of Tau (2^${power}). Do not use for production.`);
  const p0 = path.join(BUILD_DIR, `local_pot${power}_0.ptau`);
  const p1 = path.join(BUILD_DIR, `local_pot${power}_1.ptau`);
  await snarkjs.powersOfTau.newAccumulator(await snarkjs.curves.getCurveFromName("bn128"), power, p0);
  await snarkjs.powersOfTau.contribute(p0, p1, "Vero local dev", crypto.randomBytes(32).toString("hex"));
  await snarkjs.powersOfTau.preparePhase2(p1, outPath);
  fs.rmSync(p0);
  fs.rmSync(p1);
  console.log("✓ Local Powers of Tau →", outPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.circuit;
  fs.mkdirSync(PUBLIC_ZK_DIR, { recursive: true });

  const r1csPath = path.join(BUILD_DIR, `${name}.r1cs`);
  const wasmPath = path.join(BUILD_DIR, `${name}_js/${name}.wasm`);
  const zkey0Path = path.join(BUILD_DIR, `${name}_0.zkey`);
  const zkeyFinalPath = path.join(PUBLIC_ZK_DIR, `${name}_final.zkey`);
  const vkeyPath = path.join(PUBLIC_ZK_DIR, CIRCUITS[name].vkey);
  const wasmDest = path.join(PUBLIC_ZK_DIR, `${name}.wasm`);

  if (!fs.existsSync(r1csPath)) {
    throw new Error(`${r1csPath} not found. Compile the circuit first (npm run compile-circuit${name === "kyc_reveal" ? ":reveal" : ""}).`);
  }

  let ptauPath = args.ptau ? path.resolve(args.ptau) : path.join(ROOT, "circuits", CIRCUITS[name].ptau);
  if (args.localPtau !== null) {
    ptauPath = path.join(BUILD_DIR, `local_pot${args.localPtau}_final.ptau`);
    if (!fs.existsSync(ptauPath)) await makeLocalPtau(args.localPtau, ptauPath);
  }
  if (!fs.existsSync(ptauPath)) {
    throw new Error(`Powers of Tau file not found: ${ptauPath}. See the header of this script.`);
  }

  console.log(`⚡ Setting up Groth16 proving system for ${name}...`);

  // Phase 2 setup
  await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkey0Path);
  console.log("✓ Phase 2 key generated");

  // Contribute randomness (in production: use a real MPC ceremony)
  await snarkjs.zKey.contribute(zkey0Path, zkeyFinalPath, "ZKX Demo Contributor", crypto.randomBytes(32).toString("hex"));
  console.log("✓ Contribution complete");

  // Export verification key
  const vkey = await snarkjs.zKey.exportVerificationKey(zkeyFinalPath);
  fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
  console.log("✓ Verification key exported →", vkeyPath);

  // Copy wasm to public/zk/
  fs.copyFileSync(wasmPath, wasmDest);
  console.log("✓ Wasm copied →", wasmDest);

  console.log("\n✅ ZK setup complete. Run `npm run dev` to start.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
