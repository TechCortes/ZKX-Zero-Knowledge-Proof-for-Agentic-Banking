/**
 * Transaction IDs. Random (UUID v4), so two payments approved in the same
 * millisecond — or on two serverless instances — can never share an ID.
 * Older audit records keep their `zkx_<timestamp>` IDs; both forms stay valid.
 */
export function newTxId(): string {
  return `zkx_${crypto.randomUUID()}`;
}
