import { health } from '@/lib/health';

// GET /healthz — this is the path the shared suite (tests/run.py) asks for.
// `/health` is kept as an alias because briefs/lane-e.md named that one.
export function GET(): Response {
  return Response.json(health());
}
