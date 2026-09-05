import type { DatabaseSync } from 'node:sqlite';
import { many } from './query.ts';
import { nowJstIso } from '../jst.ts';

export type HistoryAction = 'create' | 'update' | 'delete' | 'restore';
export type HistoryEntityType = 'owner' | 'patient' | 'visit';
export type FieldChange = { field: string; before: unknown; after: unknown };

export type HistoryEntryRow = {
  id: number;
  entity_type: HistoryEntityType;
  entity_id: number;
  karte_no: string | null;
  owner_no: string | null;
  action: HistoryAction;
  occurred_at: string;
  staff_id: number | null;
  reason: string | null;
  changes: string; // JSON-encoded FieldChange[]
};

export function recordHistory(
  db: DatabaseSync,
  entry: {
    entityType: HistoryEntityType;
    entityId: number;
    karteNo?: string | null;
    ownerNo?: string | null;
    action: HistoryAction;
    staffId?: number | null;
    reason?: string | null;
    changes?: FieldChange[];
  },
): void {
  db.prepare(
    `INSERT INTO history_entry
       (entity_type, entity_id, karte_no, owner_no, action, occurred_at, staff_id, reason, changes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.entityType,
    entry.entityId,
    entry.karteNo ?? null,
    entry.ownerNo ?? null,
    entry.action,
    nowJstIso(),
    entry.staffId ?? null,
    entry.reason ?? null,
    JSON.stringify(entry.changes ?? []),
  );
}

/** Diffs two plain field-maps into the `changes` shape `recordHistory` stores. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(after)) {
    if (!(field in before)) continue;
    if (before[field] !== after[field]) changes.push({ field, before: before[field], after: after[field] });
  }
  return changes;
}

/** History for one animal, newest first: its own owner/patient rows plus any Visit rows tied to it. */
export function listHistoryForKarteNo(db: DatabaseSync, karteNo: string): HistoryEntryRow[] {
  return many<HistoryEntryRow>(
    db.prepare(
      `SELECT * FROM history_entry
       WHERE karte_no = ?
          OR (entity_type = 'owner' AND owner_no = (SELECT o.owner_no FROM owner o
              JOIN patient p ON p.owner_id = o.id WHERE p.karte_no = ?))
       ORDER BY occurred_at DESC, id DESC`,
    ),
    karteNo,
    karteNo,
  );
}
