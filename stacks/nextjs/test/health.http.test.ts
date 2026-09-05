import { test } from 'node:test';
import assert from 'node:assert/strict';

// HTTP-level smoke test, the same shape as the shared suite (tests/run.py).
// No BASE_URL means "test against this lane's own port" (coordination/PORTS.md),
// not "skip" -- a partial-run green is not allowed to look like a real green
// (指揮役 R-14 / R-19). If nothing is listening there, fetch throws and the
// test fails loudly instead of reporting a false pass.
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:8405';

// /healthz is what the shared suite asks for; /health is the alias named in
// this lane's brief. Both must answer until the frozen spec settles it.
for (const path of ['/healthz', '/health']) {
  test(`GET ${path} returns {"status":"ok"}`, async () => {
    const res = await fetch(new URL(path, baseUrl));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type')?.split(';')[0], 'application/json');
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
}
