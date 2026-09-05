/**
 * Read-only access to the project's fixed data ("マスタ"), for the
 * `/settings/master(/{key})` screens and the `/api/masters/{key}` API.
 *
 * `spec/README.md`「マスタ管理の画面：一覧と参照は作る。編集は作らない」—
 * there is deliberately no write path here, not even one this module could
 * expose by accident: everything below returns plain data, never a
 * statement handle.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleDir } from './paths.ts';

const REPO_DATA = resolve(moduleDir(import.meta.dirname, import.meta.url), '../../../../data');

type Json = Record<string, unknown>;
type MasterItem = { code: string; label: string } & Record<string, unknown>;

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(REPO_DATA, name), 'utf8'));
}

function loadPriceItems(): MasterItem[] {
  const items = readJson('price_items.json') as Json[];
  return items.map(({ price_code, name, ...rest }) => ({
    code: String(price_code),
    label: String(name),
    ...rest,
  }));
}

function loadLabItems(): MasterItem[] {
  const items = readJson('lab_items.json') as Json[];
  return items.map(({ item_code, name, ...rest }) => ({
    code: String(item_code),
    label: String(name),
    ...rest,
  }));
}

function loadMastersJson(list: string): MasterItem[] {
  const masters = readJson('masters.json') as Json;
  const items = masters[list] as Json[];
  return items.map(({ code, name, ...rest }) => ({
    code: String(code),
    label: String(name),
    ...rest,
  }));
}

/**
 * `data/masters.json`'s `phrases` entry is shaped differently from the
 * other lists (a category name mapped straight to an array of strings, with
 * no `code`/`name` of its own) because it is just wording, not a coded
 * vocabulary. It is flattened here so it can still answer to `code`/`label`
 * like every other master.
 */
function loadPhrases(): MasterItem[] {
  const masters = readJson('masters.json') as Json;
  const phrases = masters.phrases as Record<string, string[]>;
  const out: MasterItem[] = [];
  for (const [category, texts] of Object.entries(phrases)) {
    texts.forEach((text, i) => {
      out.push({ code: `${category}#${i + 1}`, label: text, category });
    });
  }
  return out;
}

type MasterDef = { title: string; load: () => MasterItem[] };

const MASTER_DEFS: Record<string, MasterDef> = {
  price_item: { title: '料金', load: loadPriceItems },
  lab_item: { title: '検査項目', load: loadLabItems },
  reception_kind: { title: '受付区分', load: () => loadMastersJson('reception_kinds') },
  prevention_kind: { title: '予防種別', load: () => loadMastersJson('prevention_kinds') },
  department: { title: '診療科', load: () => loadMastersJson('departments') },
  phrase: { title: '定型文', load: loadPhrases },
};

export const MASTER_KEYS = Object.keys(MASTER_DEFS);
export const DEFAULT_MASTER_KEY = 'price_item';

export function masterTitle(key: string): string | undefined {
  return MASTER_DEFS[key]?.title;
}

/** `undefined` for an unknown key (the caller answers 404), never an empty list standing in for "not found". */
export function loadMaster(key: string): MasterItem[] | undefined {
  return MASTER_DEFS[key]?.load();
}
