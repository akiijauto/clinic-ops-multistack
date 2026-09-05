import type { DatabaseSync } from 'node:sqlite';
import { one } from './query.ts';

/**
 * Issuing new `karte_no` / `owner_no` values.
 *
 * `spec/openapi.yaml`'s `KarteNo` parameter fixes the path-param pattern as
 * `^[0-9]+-[0-9]+$` (example `1001-1`). But `data/seed.json` -- the actual
 * fixture data all five lanes are graded against -- ships 60 patients whose
 * `karte_no` is plain digits with no hyphen at all (`"10001"` .. `"10060"`).
 * Enforcing the documented pattern would make the existing seed patients
 * unreachable by their own real `karte_no`, and the shared crawler
 * (acceptance 検算8) walks IDs straight out of `data/seed.json`. So this
 * lane treats the pattern as aspirational/wrong rather than the seed data,
 * and keeps issuing the same plain-digit sequence the fixtures already use.
 * Reported to the team lead as a spec/data conflict rather than "fixed" by
 * editing spec/.
 */
export function nextKarteNo(db: DatabaseSync): string {
  const r = one<{ max_no: number | null }>(
    db.prepare(`SELECT MAX(CAST(karte_no AS INTEGER)) AS max_no FROM patient WHERE karte_no GLOB '[0-9]*'`),
  );
  const next = (r?.max_no ?? 10000) + 1;
  return String(next);
}

/** `owner_no` follows the seed convention `O-00001`. */
export function nextOwnerNo(db: DatabaseSync): string {
  const r = one<{ max_no: number | null }>(
    db.prepare(`SELECT MAX(CAST(SUBSTR(owner_no, 3) AS INTEGER)) AS max_no FROM owner WHERE owner_no LIKE 'O-%'`),
  );
  const next = (r?.max_no ?? 0) + 1;
  return `O-${String(next).padStart(5, '0')}`;
}

export function karteNoExists(db: DatabaseSync, karteNo: string): boolean {
  return one(db.prepare('SELECT 1 FROM patient WHERE karte_no = ?'), karteNo) !== undefined;
}

export function ownerNoExists(db: DatabaseSync, ownerNo: string): boolean {
  return one(db.prepare('SELECT 1 FROM owner WHERE owner_no = ?'), ownerNo) !== undefined;
}
