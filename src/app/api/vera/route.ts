/**
 * Deprecated alias of /api/assistant (the assistant was renamed from "Vera").
 * Same handler, same response, so older clients keep working. Remove in the
 * 90-day alias cleanup (ROADMAP).
 *
 * Route segment config must be declared literally in each route file.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { POST } from "../assistant/route";
