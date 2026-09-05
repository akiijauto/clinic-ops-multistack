/**
 * JST (UTC+09:00) date handling.
 *
 * `spec/openapi.yaml`/`spec/acceptance.md`: everything is JST, including
 * aggregation day/month boundaries, even though storage and the server
 * clock may be UTC. This module is the one place that conversion happens,
 * so a screen and an API route never disagree about "today".
 */
const JST_OFFSET_MINUTES = 9 * 60;

/** The current instant, formatted as a JST `date-time` per the spec (`+09:00` suffix). */
export function nowJstIso(): string {
  return toJstIso(new Date());
}

/** Any instant, formatted as a JST `date-time` string (`YYYY-MM-DDTHH:mm:ss+09:00`). */
export function toJstIso(d: Date): string {
  const jst = new Date(d.getTime() + JST_OFFSET_MINUTES * 60_000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}` +
    `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`
  );
}

/** The JST calendar date (`YYYY-MM-DD`) an instant falls on. Accepts a Date or an ISO string. */
export function jstDate(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return toJstIso(d).slice(0, 10);
}

/** Today's date (`YYYY-MM-DD`) in JST. */
export function todayJst(): string {
  return jstDate(new Date());
}

/**
 * The `[startUtc, endUtc)` instants that bound a JST calendar day, for
 * querying date-time columns stored in UTC or as JST-offset ISO strings
 * with a plain string comparison (both compare correctly lexically since
 * both endpoints carry the same fixed `+09:00` offset convention used
 * throughout this lane's schema -- see `schema.sql`).
 */
export function jstDayBoundsAsJstIso(dateJst: string): { startIso: string; endIso: string } {
  const start = new Date(`${dateJst}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { startIso: toJstIso(start), endIso: toJstIso(end) };
}
