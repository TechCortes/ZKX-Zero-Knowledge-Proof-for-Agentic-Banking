/**
 * BabyJubJub and Poseidon plumbing shared by the threshold-reveal code
 * (./reveal.ts) and the distributed key generation (./dkg.ts). Points are
 * bigint pairs; every scalar is reduced mod the prime subgroup order l.
 */

export type Point = [bigint, bigint];
export type PointStr = [string, string];


/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Crypto {
  babyJub: any;
  poseidon: any;
  /** BabyJubJub prime subgroup order — all scalar math is mod this. */
  l: bigint;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cryptoPromise: Promise<Crypto> | null = null;

export function getCrypto(): Promise<Crypto> {
  if (!cryptoPromise) {
    cryptoPromise = (async () => {
      const { buildBabyjub, buildPoseidon } = await import("circomlibjs");
      const [babyJub, poseidon] = await Promise.all([buildBabyjub(), buildPoseidon()]);
      return { babyJub, poseidon, l: BigInt(babyJub.subOrder.toString()) };
    })();
  }
  return cryptoPromise;
}

export const mod = (a: bigint, m: bigint) => ((a % m) + m) % m;

export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [BigInt(1), BigInt(0)];
  while (r !== BigInt(0)) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== BigInt(1)) throw new Error("Value has no inverse modulo the subgroup order.");
  return mod(oldS, m);
}

export function toF(c: Crypto, p: Point) {
  return [c.babyJub.F.e(p[0]), c.babyJub.F.e(p[1])];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromF(c: Crypto, p: any[]): Point {
  return [BigInt(c.babyJub.F.toObject(p[0])), BigInt(c.babyJub.F.toObject(p[1]))];
}
export function mul(c: Crypto, p: Point, s: bigint): Point {
  return fromF(c, c.babyJub.mulPointEscalar(toF(c, p), mod(s, c.l)));
}
export function add(c: Crypto, a: Point, b: Point): Point {
  return fromF(c, c.babyJub.addPoint(toF(c, a), toF(c, b)));
}
export function base8(c: Crypto): Point {
  return fromF(c, c.babyJub.Base8);
}
export function inSubgroup(c: Crypto, p: Point): boolean {
  return c.babyJub.inSubgroup(toF(c, p));
}
export function hash(c: Crypto, inputs: bigint[]): bigint {
  return BigInt(c.poseidon.F.toObject(c.poseidon(inputs)));
}
export const eq = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
export const str = (p: Point): PointStr => [p[0].toString(), p[1].toString()];
export const pt = (p: PointStr): Point => [BigInt(p[0]), BigInt(p[1])];

/** Uniform scalar in [1, l). 64 random bytes reduced mod l keeps the bias negligible. */
export async function randomScalar(): Promise<bigint> {
  const { l } = await getCrypto();
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  const n = BigInt("0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));
  return mod(n, l - BigInt(1)) + BigInt(1);
}
