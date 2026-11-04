/**
 * Transaction IDs. Random (UUID v4), so two payments approved in the same
 * millisecond — or on two serverless instances — can never share an ID.
 * New IDs use the `zquent_` prefix. Older audit records keep their `zkx_<uuid>` and
 * `zkx_<timestamp>` IDs; every form stays valid (nothing parses the prefix).
 */
export function newTxId(): string {
  return `zquent_${crypto.randomUUID()}`;
}
