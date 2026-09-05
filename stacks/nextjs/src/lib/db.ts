import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { moduleDir } from './paths.ts';

/**
 * SQLite via Node's built-in `node:sqlite` (Node >= 24).
 *
 * DECISIONS.md allows each lane to pick its store as long as nothing extra
 * has to be installed. `node:sqlite` ships with the runtime, so this lane
 * carries zero database dependencies.
 *
 * The schema lives in `schema.sql`, applied on first connection.
 */
const HERE = moduleDir(import.meta.dirname, import.meta.url);
const DEFAULT_PATH = resolve(HERE, '../../data/clinic.db');

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  const path = process.env.CLINIC_DB ?? DEFAULT_PATH;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(resolve(HERE, 'schema.sql'), 'utf8'));
  return db;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}

/**
 * `node:sqlite` hands back objects with a null prototype. They stringify
 * fine, but they are not `deepStrictEqual` to plain objects and they have no
 * `hasOwnProperty`, which bites in tests and in React rendering. Every read
 * goes through here so rows are plain objects everywhere else.
 */
export function rows<T>(stmt: { all: (...p: never[]) => unknown[] }, ...params: never[]): T[] {
  return stmt.all(...params).map((r) => ({ ...(r as object) })) as T[];
}

export function row<T>(stmt: { get: (...p: never[]) => unknown }, ...params: never[]): T | undefined {
  const r = stmt.get(...params);
  return r === undefined ? undefined : ({ ...(r as object) } as T);
}
