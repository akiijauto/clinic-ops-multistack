/**
 * Historically this re-implemented `db.ts`'s `row()`/`rows()` because those
 * were declared `...params: never[]`, which only type-checked for
 * zero-argument calls. That was a real bug in the shared helper (area1
 * found it and worked around it here rather than editing a file marked
 * "use as-is, flag instead" -- correctly). `db.ts` now types its params as
 * `SQLInputValue[]`, matching `node:sqlite`'s own `StatementSync` signature,
 * so this module is just a thin re-export under the names call sites here
 * already use.
 */
export { row as one, rows as many } from '../db.ts';
