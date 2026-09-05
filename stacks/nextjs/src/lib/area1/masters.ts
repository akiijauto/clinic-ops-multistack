import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleDir } from '../paths.ts';

/** `data/masters.json` -- read-only fixed data (`spec/model.md`「変わらないもの」). */
const REPO_DATA = resolve(moduleDir(import.meta.dirname, import.meta.url), '../../../../../data');

type MasterCode = { code: string; name: string };
type Masters = {
  prevention_kinds: MasterCode[];
  reception_kinds: MasterCode[];
  departments: MasterCode[];
  phrases: Record<string, string[]>;
  price_categories: { major: string; count: number }[];
};

let cache: Masters | undefined;

export function loadMasters(): Masters {
  if (cache) return cache;
  cache = JSON.parse(readFileSync(resolve(REPO_DATA, 'masters.json'), 'utf8')) as Masters;
  return cache;
}

export function receptionKinds(): MasterCode[] {
  return loadMasters().reception_kinds;
}

export function defaultReceptionKind(): string {
  return receptionKinds()[0]?.code ?? 'first_visit';
}

export function isKnownReceptionKind(code: string): boolean {
  return receptionKinds().some((k) => k.code === code);
}
