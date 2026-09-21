/**
 * Shared key-value store for cross-request state (agent registry, spend
 * ledger, audit log).
 *
 * On Vercel, each serverless invocation can run on a different instance —
 * a plain in-process Map is invisible to every other instance, so an agent
 * registered on one request 404s when a later request lands elsewhere.
 * This is Redis-backed (Upstash, via Vercel Marketplace) whenever the
 * project has a store connected. Vercel's Marketplace integration injects
 * the legacy @vercel/kv-compatible names (KV_REST_API_URL/TOKEN) rather
 * than @upstash/redis's own UPSTASH_REDIS_REST_URL/TOKEN, so both are
 * checked. Locally and in tests, where a single Node process already
 * shares memory across "requests", it falls back to an in-memory Map so
 * `npm run dev` and `npm test` need no real Redis instance.
 */

import { Redis } from "@upstash/redis";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  /** Set key to value. With `nx`, only sets if the key doesn't already exist — returns false if it did. */
  set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<boolean>;
  /** Atomic increment; returns the new total. `ex` sets a TTL (seconds) only when the key is newly created. */
  incrby(key: string, amount: number, opts?: { ex?: number }): Promise<number>;
  /** Prepend to a list (most-recent-first). */
  lpush(key: string, value: unknown): Promise<void>;
  /** Trim a list to its first `count` entries. */
  ltrim(key: string, count: number): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
}

function redisCredentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

class RedisKv implements Kv {
  constructor(private client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    return (await this.client.get<T>(key)) ?? null;
  }

  async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<boolean> {
    const result = opts?.nx && opts?.ex
      ? await this.client.set(key, value, { nx: true, ex: opts.ex })
      : opts?.nx
      ? await this.client.set(key, value, { nx: true })
      : opts?.ex
      ? await this.client.set(key, value, { ex: opts.ex })
      : await this.client.set(key, value);
    return result !== null;
  }

  async incrby(key: string, amount: number, opts?: { ex?: number }): Promise<number> {
    const exists = await this.client.exists(key);
    const total = await this.client.incrby(key, amount);
    if (!exists && opts?.ex) {
      await this.client.expire(key, opts.ex);
    }
    return total;
  }

  async lpush(key: string, value: unknown): Promise<void> {
    await this.client.lpush(key, JSON.stringify(value));
  }

  async ltrim(key: string, count: number): Promise<void> {
    await this.client.ltrim(key, 0, count - 1);
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const raw = await this.client.lrange<string>(key, start, stop);
    return raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as T) : (r as unknown as T)));
  }
}

/** In-memory fallback — local dev / tests only. Not shared across processes. */
class MemoryKv implements Kv {
  private store = new Map<string, unknown>();
  private lists = new Map<string, string[]>();
  private expiry = new Map<string, number>();

  private isExpired(key: string): boolean {
    const at = this.expiry.get(key);
    if (at !== undefined && Date.now() > at) {
      this.store.delete(key);
      this.expiry.delete(key);
      return true;
    }
    return false;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isExpired(key)) return null;
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<boolean> {
    if (opts?.nx && !this.isExpired(key) && this.store.has(key)) return false;
    this.store.set(key, value);
    if (opts?.ex) this.expiry.set(key, Date.now() + opts.ex * 1000);
    else this.expiry.delete(key);
    return true;
  }

  async incrby(key: string, amount: number, opts?: { ex?: number }): Promise<number> {
    const existed = !this.isExpired(key) && this.store.has(key);
    const current = (this.store.get(key) as number) ?? 0;
    const total = current + amount;
    this.store.set(key, total);
    if (!existed && opts?.ex) this.expiry.set(key, Date.now() + opts.ex * 1000);
    return total;
  }

  async lpush(key: string, value: unknown): Promise<void> {
    const list = this.lists.get(key) ?? [];
    list.unshift(JSON.stringify(value));
    this.lists.set(key, list);
  }

  async ltrim(key: string, count: number): Promise<void> {
    const list = this.lists.get(key);
    if (list) this.lists.set(key, list.slice(0, count));
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.lists.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end).map((r) => JSON.parse(r) as T);
  }
}

let instance: Kv | null = null;

export function kv(): Kv {
  if (!instance) {
    const creds = redisCredentials();
    instance = creds ? new RedisKv(new Redis(creds)) : new MemoryKv();
  }
  return instance;
}
