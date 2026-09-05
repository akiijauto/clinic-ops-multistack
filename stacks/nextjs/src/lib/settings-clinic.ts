/**
 * `Clinic` read/write for the "設定（病院設定）" screen
 * (`spec/screens.md` 22, `spec/openapi.yaml` `/settings`).
 *
 * `Clinic` is always exactly one row (`spec/model.md`). This module never
 * inserts a second one: it always updates the row it finds, and only
 * inserts the very first row if the table is somehow empty.
 */
import { getDb, row } from './db';
import type { Clinic } from './model';

type ClinicRow = Omit<Clinic, 'closed_weekdays'> & { closed_weekdays: string };

function toClinic(r: ClinicRow): Clinic {
  let closed_weekdays: number[] = [];
  try {
    closed_weekdays = JSON.parse(r.closed_weekdays);
  } catch {
    closed_weekdays = [];
  }
  return { ...r, closed_weekdays };
}

export function getClinic(): Clinic | undefined {
  const db = getDb();
  const r = row<ClinicRow>(db.prepare('SELECT * FROM clinic LIMIT 1'));
  return r ? toClinic(r) : undefined;
}

export type ClinicFormResult =
  | { ok: true; value: Omit<Clinic, 'id'> }
  | { ok: false; message: string };

/** Field-by-field validation, matching `spec/openapi.yaml`'s `Clinic` constraints. */
export function parseClinicForm(form: FormData): ClinicFormResult {
  const str = (name: string) => String(form.get(name) ?? '').trim();
  const name = str('name');
  if (name.length === 0) {
    return { ok: false, message: '病院名を入力してください。' };
  }

  const slotRaw = str('reservation_slot_minutes');
  const reservation_slot_minutes = Number(slotRaw);
  if (!Number.isInteger(reservation_slot_minutes) || reservation_slot_minutes < 1) {
    return { ok: false, message: '予約枠の刻みは1以上の整数で入力してください。' };
  }

  const taxRaw = str('tax_rate');
  const tax_rate = Number(taxRaw);
  if (!Number.isFinite(tax_rate) || tax_rate < 0 || tax_rate > 1) {
    return { ok: false, message: '消費税率は0以上1以下の数値（例: 0.10）で入力してください。' };
  }

  const closed_weekdays = Array.from(new Set(form.getAll('closed_weekdays').map((v) => Number(v))))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);

  return {
    ok: true,
    value: {
      name,
      postal_code: str('postal_code'),
      address1: str('address1'),
      address2: str('address2'),
      phone: str('phone'),
      fax: str('fax'),
      director_name: str('director_name'),
      reservation_slot_minutes,
      tax_rate,
      closed_weekdays,
    },
  };
}

export function saveClinic(value: Omit<Clinic, 'id'>): Clinic {
  const db = getDb();
  const existing = row<{ id: number }>(db.prepare('SELECT id FROM clinic LIMIT 1'));
  const closed_weekdays = JSON.stringify(value.closed_weekdays);

  if (existing) {
    db.prepare(
      `UPDATE clinic SET name = ?, postal_code = ?, address1 = ?, address2 = ?, phone = ?, fax = ?,
       director_name = ?, reservation_slot_minutes = ?, tax_rate = ?, closed_weekdays = ? WHERE id = ?`,
    ).run(
      value.name,
      value.postal_code,
      value.address1,
      value.address2,
      value.phone,
      value.fax,
      value.director_name,
      value.reservation_slot_minutes,
      value.tax_rate,
      closed_weekdays,
      existing.id,
    );
    return { id: existing.id, ...value };
  }

  // Only reached if the table starts out empty (spec/model.md still holds:
  // "always exactly one row" -- this is the one insert that creates it).
  db.prepare(
    `INSERT INTO clinic (name, postal_code, address1, address2, phone, fax, director_name,
     reservation_slot_minutes, tax_rate, closed_weekdays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    value.name,
    value.postal_code,
    value.address1,
    value.address2,
    value.phone,
    value.fax,
    value.director_name,
    value.reservation_slot_minutes,
    value.tax_rate,
    closed_weekdays,
  );
  const created = row<{ id: number }>(db.prepare('SELECT id FROM clinic LIMIT 1'));
  return { id: created?.id ?? 1, ...value };
}
