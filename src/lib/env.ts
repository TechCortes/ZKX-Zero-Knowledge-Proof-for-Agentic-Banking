/**
 * Environment variables after the Vero → ZQUENT rename.
 *
 * Every protocol variable is read as `ZQUENT_<NAME>` first and falls back to
 * the legacy `VERO_<NAME>`, so deployments configured before the rename keep
 * working unchanged. The fallback logs a one-time warning per variable.
 * Remove the fallback in the 90-day alias cleanup (ROADMAP).
 */

import { logger } from "./logger";

export type ProtocolEnvName =
  | "REVEAL_PUBLIC_KEY"
  | "ESCROW_KEYS"
  | "AUDIT_SIGNING_KEY"
  | "REGISTRY_FILE"
  | "REGISTRY_MEMBERS_ID"
  | "DISCLOSURE_DAILY_LIMIT"
  | "ISSUER_PUBLIC_KEY"
  | "ISSUER_PRIVATE_KEY"
  | "PERSON_DAILY_LIMIT";

const warned = new Set<ProtocolEnvName>();

/** Preferred variable name, e.g. `ZQUENT_ESCROW_KEYS`. */
export function envName(name: ProtocolEnvName): string {
  return `ZQUENT_${name}`;
}

/** Legacy variable name, e.g. `VERO_ESCROW_KEYS`. */
export function legacyEnvName(name: ProtocolEnvName): string {
  return `VERO_${name}`;
}

/** Human-readable label for error messages: names both, so either can be fixed. */
export function envLabel(name: ProtocolEnvName): string {
  return `${envName(name)} (or legacy ${legacyEnvName(name)})`;
}

/** Trimmed value of `ZQUENT_<name>`, else `VERO_<name>`, else undefined. */
export function readProtocolEnv(name: ProtocolEnvName): string | undefined {
  const current = process.env[envName(name)]?.trim();
  if (current) return current;
  const legacy = process.env[legacyEnvName(name)]?.trim();
  if (legacy) {
    if (!warned.has(name)) {
      warned.add(name);
      logger.warn("env", "legacy_env_var", { using: legacyEnvName(name), rename_to: envName(name) });
    }
    return legacy;
  }
  return undefined;
}
