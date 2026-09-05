/**
 * `src/lib/db.ts`'s shared `row()` / `rows()` helpers are declared with the
 * extra query parameters typed `...params: never[]`, which only type-checks
 * for zero-argument calls -- passing any actual bind value (`row(stmt, id)`)
 * fails `tsc --strict` (`Argument of type 'string' is not assignable to
 * parameter of type 'never'`, confirmed by compiling a throwaway call).
 * `db.ts` is one of the shared files area1 was told to use as-is and flag
 * rather than edit, so this module re-implements the same one-line
 * normalization (`node:sqlite` rows have a null prototype -- see `db.ts`'s
 * own comment) for the parameterized calls area1 needs everywhere. Reported
 * to the team lead as a bug in the shared helper.
 */
export function one<T>(stmt: { get: (...p: unknown[]) => unknown }, ...params: unknown[]): T | undefined {
  const r = stmt.get(...params);
  return r === undefined ? undefined : ({ ...(r as object) } as T);
}

export function many<T>(stmt: { all: (...p: unknown[]) => unknown[] }, ...params: unknown[]): T[] {
  return stmt.all(...params).map((r) => ({ ...(r as object) })) as T[];
}
