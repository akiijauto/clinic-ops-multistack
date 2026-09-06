/**
 * DM (次回予定日をもとにした案内対象の検索・書き出し) — `spec/screens.md`「16. DM」.
 *
 * Shared by the screen (`/dm`), its CSV export (`/dm.csv`), and the JSON API
 * (`/api/dm`) so the three can never disagree about which rows match a given
 * filter (`spec/screens.md`「CSVの件数は、画面に表示されている件数と一致する」).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, rows } from './db';
import { moduleDir } from './paths.ts';

export type DmField = 'next_due_date' | 'performed_date';

export type DmRow = {
  karte_no: string;
  owner_name_kanji: string;
  patient_name_kanji: string;
  kind: string | null;
  kind_name: string | null;
  next_due_date: string | null;
  performed_date: string | null;
};

export type DmFilter = {
  /**
   * `spec/openapi.yaml`'s `/dm` names this `type` (an integer). `masters.json`'s
   * `prevention_kinds` array has no numeric id of its own, so this is its
   * **1-based position** in that array (`kind_id` in the same sense as the
   * `PreventionKindId` path parameter elsewhere in the contract). Reported as
   * an interpretation, not a discovered rule -- `spec/model.md` doesn't fix a
   * numbering for this master.
   */
  type?: number;
  field?: DmField;
  from?: string;
  to?: string;
  /**
   * `spec/screens.md`「16. DM」lists 実施内容・**日付範囲**・並び順 as the
   * screen's filters but `spec/openapi.yaml`'s `/dm` also has a `span` query
   * param with no description. Interpreted as "days from `from` (or today)",
   * a common shorthand for "次回予定日が近い順にN日以内" DM lists; only used
   * when `to` is not given directly.
   */
  span?: number;
};

let preventionKindsCache: { code: string; name: string }[] | undefined;
function preventionKinds(): { code: string; name: string }[] {
  if (!preventionKindsCache) {
    const masters = JSON.parse(
      readFileSync(resolve(moduleDir(import.meta.dirname, import.meta.url), '../../../../data/masters.json'), 'utf8'),
    ) as { prevention_kinds: { code: string; name: string }[] };
    preventionKindsCache = masters.prevention_kinds;
  }
  return preventionKindsCache;
}

function kindNameOf(code: string | null): string | null {
  if (!code) return null;
  return preventionKinds().find((k) => k.code === code)?.name ?? code;
}

/** `type` query param -> `prevention.kind` code, per the 1-based-position interpretation above. */
export function kindCodeForType(type: number | undefined): string | undefined {
  if (type === undefined) return undefined;
  return preventionKinds()[type - 1]?.code;
}

export function listDmRows(filter: DmFilter): DmRow[] {
  const field: DmField = filter.field ?? 'next_due_date';
  const kindCode = kindCodeForType(filter.type);

  let from = filter.from;
  let to = filter.to;
  if (!to && from && filter.span !== undefined) {
    const d = new Date(`${from}T00:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + filter.span);
    to = d.toISOString().slice(0, 10);
  }

  const clauses = [`${field} IS NOT NULL`, 'p.deleted_at IS NULL', 'o.deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (kindCode) {
    clauses.push('pr.kind = ?');
    params.push(kindCode);
  }
  if (from) {
    clauses.push(`pr.${field} >= ?`);
    params.push(from);
  }
  if (to) {
    clauses.push(`pr.${field} <= ?`);
    params.push(to);
  }

  const found = rows<{
    karte_no: string;
    owner_name_kanji: string;
    patient_name_kanji: string;
    kind: string;
    next_due_date: string | null;
    performed_date: string | null;
  }>(
    getDb().prepare(
      `SELECT p.karte_no AS karte_no, o.name_kanji AS owner_name_kanji, p.name_kanji AS patient_name_kanji,
              pr.kind AS kind, pr.next_due_date AS next_due_date, pr.performed_date AS performed_date
       FROM prevention pr
       JOIN patient p ON p.id = pr.patient_id
       JOIN owner o ON o.id = p.owner_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY pr.${field} ASC`,
    ),
    ...params,
  );

  return found.map((r) => ({ ...r, kind_name: kindNameOf(r.kind) }));
}

/** UTF-8, no BOM (`coordination/review/2026-09-05_2巡目.md` R-17: the contract fixes nothing else). */
export function toCsv(rows: DmRow[]): string {
  const header = ['karte_no', 'owner_name_kanji', 'patient_name_kanji', 'kind', 'kind_name', 'next_due_date', 'performed_date'];
  const esc = (v: string | null): string => {
    const s = v ?? '';
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.karte_no, r.owner_name_kanji, r.patient_name_kanji, r.kind ?? '', r.kind_name ?? '', r.next_due_date ?? '', r.performed_date ?? ''].map(esc).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
