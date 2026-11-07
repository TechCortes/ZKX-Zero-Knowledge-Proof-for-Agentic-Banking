/**
 * ZQUENT — credential issuer CLI (plan item I1). See docs/credentials.md.
 *
 *   npm run issuer -- keygen
 *       Prints a fresh issuer key pair as env lines:
 *         ZQUENT_ISSUER_PRIVATE_KEY (secret; turns on the demo issuer)
 *         ZQUENT_ISSUER_PUBLIC_KEY  (public; the key every proof is pinned to)
 *
 *   npm run issuer -- issue --id-hash <decimal> --birth-year <yyyy> [--expiry-day <n>]
 *       Signs a credential with ZQUENT_ISSUER_PRIVATE_KEY and prints it as JSON.
 *
 *   npm run issuer -- check <credential.json>
 *       Verifies a credential's signature (against ZQUENT_ISSUER_PUBLIC_KEY if set).
 */

import fs from "fs";
import { generateIssuerPrivateKey, issueCredential, issuerPublicKey, verifyCredential, type Credential } from "../src/zkp/credential";
import { getDemoIssuerPrivateKey, getIssuerPublicKey } from "../src/zkp/issuerConfig";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "keygen") {
    const sk = generateIssuerPrivateKey();
    const pk = await issuerPublicKey(sk);
    console.log(`ZQUENT_ISSUER_PRIVATE_KEY=${sk}`);
    console.log(`ZQUENT_ISSUER_PUBLIC_KEY=${pk.join(",")}`);
    console.error("\nKeep the private key secret. Set both on the server to run the demo issuer;");
    console.error("set only the public key to pin a real issuer.");
    return;
  }
  if (cmd === "issue") {
    const sk = await getDemoIssuerPrivateKey();
    if (!sk) throw new Error("Set ZQUENT_ISSUER_PRIVATE_KEY first (npm run issuer -- keygen).");
    const expiry = flag(args, "expiry-day");
    const cred = await issueCredential(sk, {
      idHash: flag(args, "id-hash") ?? "",
      birthYear: Number(flag(args, "birth-year")),
      expiryDay: expiry === undefined ? undefined : Number(expiry),
    });
    console.log(JSON.stringify(cred, null, 2));
    return;
  }
  if (cmd === "check") {
    if (!args[0]) throw new Error("check needs a credential file.");
    const cred = JSON.parse(fs.readFileSync(args[0], "utf-8")) as Credential;
    const pinned = await getIssuerPublicKey();
    const ok = await verifyCredential(cred, pinned ?? undefined);
    console.log(ok ? `✓ Valid${pinned ? ", from the pinned issuer" : " (no issuer pinned: signature only)"}.` : "✗ Invalid.");
    process.exit(ok ? 0 : 1);
  }
  console.log("Usage: npm run issuer -- keygen | issue --id-hash <n> --birth-year <yyyy> [--expiry-day <n>] | check <file>");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
