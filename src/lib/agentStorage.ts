/**
 * Browser storage key for the registered demo agent (agentId, apiKey and the
 * private proof inputs, which never leave the browser).
 *
 * The key was renamed from `zkx_agent` to `zquent_agent`. `migrateLegacyAgentStorage`
 * moves an existing entry across once, so returning users keep their agent.
 * Remove the migration in the 90-day alias cleanup (ROADMAP).
 */

export const AGENT_STORAGE_KEY = "zquent_agent";
export const LEGACY_AGENT_STORAGE_KEY = "zkx_agent";

/** Copies `zkx_agent` to `zquent_agent` (unless the new key already exists), then removes the old one. Never throws. */
export function migrateLegacyAgentStorage(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): void {
  try {
    const legacy = storage.getItem(LEGACY_AGENT_STORAGE_KEY);
    if (legacy === null) return;
    if (storage.getItem(AGENT_STORAGE_KEY) === null) {
      storage.setItem(AGENT_STORAGE_KEY, legacy);
    }
    storage.removeItem(LEGACY_AGENT_STORAGE_KEY);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
