/**
 * Health payload.
 *
 * Kept out of the route module on purpose: the route file is a Next.js
 * entry point, but this function is plain TypeScript, so `node --test`
 * can import it without booting the framework.
 */
export type HealthPayload = { status: 'ok' };

export function health(): HealthPayload {
  return { status: 'ok' };
}
