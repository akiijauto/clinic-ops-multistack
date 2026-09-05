import { health } from '@/lib/health';

// GET /health — alias of /healthz. briefs/lane-e.md asked for this path;
// tests/run.py asks for /healthz. Both are served until the frozen
// spec/openapi.yaml settles which one is the contract.
export function GET(): Response {
  return Response.json(health());
}
