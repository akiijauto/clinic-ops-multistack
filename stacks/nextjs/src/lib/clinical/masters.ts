/**
 * Fixed-data loaders for area 2 (診療): `data/masters.json` and
 * `data/lab_items.json`. Read-only, per `spec/model.md`「変わらないもの」
 * -- never written back to, never edited from a screen.
 *
 * `data/masters.json`'s `prevention_kinds` has no numeric id, only a
 * `code`/`name` pair. `spec/openapi.yaml`'s `DosingKindId`/`PreventionKindId`
 * path parameters are typed `integer`, though, and the team lead's brief
 * says dosing shares its kind vocabulary with prevention ("種別は
 * data/masters.json の予防の種別と共通"). Decision: `kind_id` is the
 * 1-based position of the entry in `prevention_kinds`, used for both
 * screens. Not written anywhere in spec/ -- flagged in the final report.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleDir } from '../paths.ts';

const DATA_DIR = resolve(moduleDir(import.meta.dirname, import.meta.url), '../../../../../data');

export type PreventionKind = { id: number; code: string; name: string };

export type LabReferenceRange = { species: string; sex: string; low: number; high: number };
export type LabItem = { item_code: string; name: string; unit: string; category: string; reference_ranges: LabReferenceRange[] };

let preventionKindsCache: PreventionKind[] | undefined;
let labItemsCache: Map<string, LabItem> | undefined;

export function listPreventionKinds(): PreventionKind[] {
  if (!preventionKindsCache) {
    const raw = JSON.parse(readFileSync(resolve(DATA_DIR, 'masters.json'), 'utf8')) as {
      prevention_kinds: { code: string; name: string }[];
    };
    preventionKindsCache = raw.prevention_kinds.map((k, i) => ({ id: i + 1, code: k.code, name: k.name }));
  }
  return preventionKindsCache;
}

export function preventionKindById(id: number): PreventionKind | undefined {
  return listPreventionKinds().find((k) => k.id === id);
}

export function preventionKindByCode(code: string): PreventionKind | undefined {
  return listPreventionKinds().find((k) => k.code === code);
}

function labItems(): Map<string, LabItem> {
  if (!labItemsCache) {
    const raw = JSON.parse(readFileSync(resolve(DATA_DIR, 'lab_items.json'), 'utf8')) as LabItem[];
    labItemsCache = new Map(raw.map((item) => [item.item_code, item]));
  }
  return labItemsCache;
}

export function listLabItems(): LabItem[] {
  return [...labItems().values()];
}

export function labItemByCode(code: string): LabItem | undefined {
  return labItems().get(code);
}

/**
 * `species` in `data/lab_items.json` is one of `dog` / `cat` / `other`.
 * `data/seed.json` patients also carry `ferret` / `rabbit`, which are not
 * dog or cat, so they fall back to `other` (spec/screens.md 10「その患者の
 * 種別・性別で引く」-- no third bucket is defined, so "not dog/cat" is the
 * only reading that keeps every patient matchable).
 */
export function labSpeciesBucket(species: string): 'dog' | 'cat' | 'other' {
  return species === 'dog' || species === 'cat' ? species : 'other';
}

/**
 * Finds the reference range for one item + patient. Prefers a sex-specific
 * range over `sex: "any"` when both exist for the species (data/lab_items.json
 * has this for ALB/CRE dog/cat). Returns undefined when no combination
 * matches -- spec/screens.md 10: "無ければ判定なし".
 */
export function findReferenceRange(itemCode: string, species: string, sex: string): LabReferenceRange | undefined {
  const item = labItemByCode(itemCode);
  if (!item) return undefined;
  const bucket = labSpeciesBucket(species);
  const candidates = item.reference_ranges.filter((r) => r.species === bucket);
  return candidates.find((r) => r.sex === sex) ?? candidates.find((r) => r.sex === 'any');
}
