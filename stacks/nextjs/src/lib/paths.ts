import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/**
 * `import.meta.dirname` resolves fine when a module is evaluated directly
 * by Node (`node --test`, `next.config.ts`), but comes back `undefined`
 * once Turbopack bundles the same module for the dev/prod server -- every
 * route that touched `db.ts` (or any of the masters/import helpers below)
 * 500'd with `TypeError: The "paths[0]" argument must be of type string.
 * Received undefined` the first time an API route actually ran end to end
 * (2026-09-05; smoke only ever exercised `/healthz`, which doesn't import
 * these). `import.meta.url` survives bundling in both cases, so derive the
 * directory from that instead of relying on `import.meta.dirname` directly.
 */
export function moduleDir(importMetaDirname: string | undefined, importMetaUrl: string): string {
  return importMetaDirname ?? dirname(fileURLToPath(importMetaUrl));
}
