import { getDb, rows, row } from '@/lib/db';
import { findConflict, isValidSpan, type ReservationSlot } from '@/lib/reservation';
import { ApiError } from '@/lib/errors';
import { jstDayBoundsAsJstIso } from '@/lib/jst';
import { getPatientByKarteNo, getPatientById as getPatientByIdArea1 } from '@/lib/area1/data';
import type { CareRecord, Hospitalization, Patient, Reservation, Staff } from '@/lib/model';

/** DB row shapes match `schema.sql` column names 1:1 (no aliasing needed). */

// ---------------------------------------------------------------------------
// Patients -- area1 owns `Patient`; these are thin re-exports so area4 routes
// don't reach into `patient` with their own SQL.
// ---------------------------------------------------------------------------

export function findPatientByKarteNo(karteNo: string): Patient | undefined {
  return getPatientByKarteNo(getDb(), karteNo);
}

export function findPatientById(id: number): Patient | undefined {
  return getPatientByIdArea1(getDb(), id);
}

function requirePatient(karteNo: string): Patient {
  const p = findPatientByKarteNo(karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export function listStaff(isActive?: boolean): Staff[] {
  const sql = 'SELECT id, staff_code, name, role, is_active FROM staff' + (isActive === undefined ? '' : ' WHERE is_active = ?') + ' ORDER BY staff_code';
  const stmt = getDb().prepare(sql);
  const list = isActive === undefined ? rows<Omit<Staff, 'is_active'> & { is_active: number }>(stmt) : rows<Omit<Staff, 'is_active'> & { is_active: number }>(stmt, isActive ? 1 : 0);
  return list.map((s) => ({ ...s, is_active: !!s.is_active }));
}

export function findStaffById(id: number): Staff | undefined {
  const s = row<Omit<Staff, 'is_active'> & { is_active: number }>(getDb().prepare('SELECT id, staff_code, name, role, is_active FROM staff WHERE id = ?'), id);
  return s ? { ...s, is_active: !!s.is_active } : undefined;
}

// ---------------------------------------------------------------------------
// Hospitalization / care records (画面18-19の入院・入院一覧)
// ---------------------------------------------------------------------------

type HospitalizationRow = { id: number; patient_id: number; admitted_on: string; discharged_on: string | null; room: string };
type CareRecordRow = { id: number; hospitalization_id: number; row_no: number; recorded_at: string; category: string; content: string; performed_by_staff_id: number };

function careRecordsOf(hospitalizationId: number): CareRecord[] {
  return rows<CareRecordRow>(
    getDb().prepare('SELECT id, hospitalization_id, row_no, recorded_at, category, content, performed_by_staff_id FROM care_record WHERE hospitalization_id = ? ORDER BY row_no'),
    hospitalizationId,
  );
}

function toHospitalization(h: HospitalizationRow): Hospitalization {
  return { ...h, care_records: careRecordsOf(h.id) };
}

export function hospitalizationsForPatient(patientId: number): Hospitalization[] {
  const list = rows<HospitalizationRow>(
    getDb().prepare('SELECT id, patient_id, admitted_on, discharged_on, room FROM hospitalization WHERE patient_id = ? ORDER BY admitted_on DESC, id DESC'),
    patientId,
  );
  return list.map(toHospitalization);
}

export function hospitalizationsForPatientByKarteNo(karteNo: string): Hospitalization[] {
  return hospitalizationsForPatient(requirePatient(karteNo).id);
}

export function findHospitalization(id: number): Hospitalization | undefined {
  const h = row<HospitalizationRow>(getDb().prepare('SELECT id, patient_id, admitted_on, discharged_on, room FROM hospitalization WHERE id = ?'), id);
  return h ? toHospitalization(h) : undefined;
}

function requireHospitalization(id: number): Hospitalization {
  const h = findHospitalization(id);
  if (!h) throw new ApiError('not_found');
  return h;
}

/** JST calendar date `dateJst` falls inside `[admitted_on, discharged_on]` (open-ended if not yet discharged). */
export function hospitalizationsActiveOn(dateJst: string): Hospitalization[] {
  const list = rows<HospitalizationRow>(
    getDb().prepare(
      'SELECT id, patient_id, admitted_on, discharged_on, room FROM hospitalization ' +
        'WHERE admitted_on <= ? AND (discharged_on IS NULL OR discharged_on >= ?) ' +
        'ORDER BY admitted_on, id',
    ),
    dateJst,
    dateJst,
  );
  return list.map(toHospitalization);
}

export type HospitalizationInput = { admitted_on: unknown; discharged_on?: unknown; room: unknown };

function validateHospitalizationInput(input: HospitalizationInput): { admitted_on: string; discharged_on: string | null; room: string } {
  const details = [];
  if (typeof input.admitted_on !== 'string' || input.admitted_on.length === 0) {
    details.push({ field: 'admitted_on', message: '入院日（admitted_on）は必須です。' });
  }
  if (typeof input.room !== 'string' || input.room.length === 0) {
    details.push({ field: 'room', message: '処置室（room）は必須です。' });
  }
  const dischargedOn = input.discharged_on;
  if (dischargedOn !== undefined && dischargedOn !== null && typeof dischargedOn !== 'string') {
    details.push({ field: 'discharged_on', message: '退院日（discharged_on）は日付文字列かnullで指定してください。' });
  }
  if (details.length > 0) throw new ApiError('invalid_input', details);
  return {
    admitted_on: input.admitted_on as string,
    discharged_on: (dischargedOn as string | null | undefined) ?? null,
    room: input.room as string,
  };
}

export function admitPatient(karteNo: string, input: HospitalizationInput): Hospitalization {
  const patient = requirePatient(karteNo);
  const v = validateHospitalizationInput(input);
  const info = getDb()
    .prepare('INSERT INTO hospitalization (patient_id, admitted_on, discharged_on, room) VALUES (?, ?, ?, ?)')
    .run(patient.id, v.admitted_on, v.discharged_on, v.room);
  return requireHospitalization(Number(info.lastInsertRowid));
}

export function updateHospitalization(id: number, input: HospitalizationInput): Hospitalization {
  requireHospitalization(id);
  const v = validateHospitalizationInput(input);
  getDb().prepare('UPDATE hospitalization SET admitted_on = ?, discharged_on = ?, room = ? WHERE id = ?').run(v.admitted_on, v.discharged_on, v.room, id);
  return requireHospitalization(id);
}

/** 退院日だけを入れて入院を終える (spec/screens.md 18「退院日を入力して入院を終了する」). */
export function dischargeHospitalization(id: number, dischargedOn: string): Hospitalization {
  const h = requireHospitalization(id);
  if (typeof dischargedOn !== 'string' || dischargedOn.length === 0) {
    throw new ApiError('invalid_input', [{ field: 'discharged_on', message: '退院日（discharged_on）は必須です。' }]);
  }
  getDb().prepare('UPDATE hospitalization SET discharged_on = ?, room = ? WHERE id = ?').run(dischargedOn, h.room, id);
  return requireHospitalization(id);
}

export type CareRecordInput = { recorded_at: unknown; category: unknown; content?: unknown; performed_by_staff_id: unknown };

export function addCareRecord(hospitalizationId: number, input: CareRecordInput): CareRecord {
  const h = requireHospitalization(hospitalizationId);

  // 退院済み(discharged_on あり)の入院には新規記録を追加できない(spec/screens.md 18)。
  if (h.discharged_on !== null) {
    throw new ApiError('invalid_input', [{ field: 'discharged_on', message: '退院済みの入院には記録を追加できません。' }]);
  }

  const details = [];
  if (typeof input.recorded_at !== 'string' || input.recorded_at.length === 0) {
    details.push({ field: 'recorded_at', message: '記録日時（recorded_at）は必須です。' });
  }
  if (typeof input.category !== 'string' || !['medication', 'feeding', 'measurement'].includes(input.category)) {
    details.push({ field: 'category', message: '種別（category）は medication/feeding/measurement のいずれかです。' });
  }
  // 実施者が空の記録行は保存を拒否する(spec/screens.md 18, spec/acceptance.md 検算7)。
  const performedBy = input.performed_by_staff_id;
  if (typeof performedBy !== 'number' || !Number.isInteger(performedBy) || !findStaffById(performedBy)) {
    details.push({ field: 'performed_by_staff_id', message: '実施者（performed_by_staff_id）は必須です。' });
  }
  if (details.length > 0) throw new ApiError('invalid_input', details);

  const nextRowNo = (row<{ n: number }>(getDb().prepare('SELECT COALESCE(MAX(row_no), 0) + 1 AS n FROM care_record WHERE hospitalization_id = ?'), hospitalizationId)?.n) ?? 1;

  getDb()
    .prepare('INSERT INTO care_record (hospitalization_id, row_no, recorded_at, category, content, performed_by_staff_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(hospitalizationId, nextRowNo, input.recorded_at as string, input.category as string, (input.content as string | null | undefined) ?? '', performedBy as number);

  const created = row<CareRecordRow>(
    getDb().prepare('SELECT id, hospitalization_id, row_no, recorded_at, category, content, performed_by_staff_id FROM care_record WHERE hospitalization_id = ? AND row_no = ?'),
    hospitalizationId,
    nextRowNo,
  );
  if (!created) throw new ApiError('save_failed');
  return created;
}

// ---------------------------------------------------------------------------
// Reservations (画面19｜予約)
// ---------------------------------------------------------------------------

type ReservationRow = {
  id: number;
  patient_id: number;
  starts_at: string;
  ends_at: string;
  staff_id: number;
  room: string;
  purpose: string;
  note: string;
  status: 'booked' | 'cancelled';
};

export type ReservationFilter = { from?: string; to?: string; staff_id?: number; room?: string; status?: 'booked' | 'cancelled'; limit?: number; offset?: number };

export function listReservations(filter: ReservationFilter): { items: Reservation[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.from) {
    where.push('starts_at >= ?');
    params.push(jstDayBoundsAsJstIso(filter.from).startIso);
  }
  if (filter.to) {
    // `to` is inclusive of the whole JST day, so the upper bound is exclusive
    // of the *next* day's start (spec/screens.md common rules: JST day/month
    // boundaries).
    where.push('starts_at < ?');
    params.push(jstDayBoundsAsJstIso(filter.to).endIso);
  }
  if (filter.staff_id !== undefined) {
    where.push('staff_id = ?');
    params.push(filter.staff_id);
  }
  if (filter.room) {
    where.push('room = ?');
    params.push(filter.room);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const total = row<{ n: number }>(getDb().prepare(`SELECT COUNT(*) AS n FROM reservation ${whereSql}`), ...params)?.n ?? 0;

  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const items = rows<ReservationRow>(
    getDb().prepare(`SELECT id, patient_id, starts_at, ends_at, staff_id, room, purpose, note, status FROM reservation ${whereSql} ORDER BY starts_at LIMIT ? OFFSET ?`),
    ...params,
    limit,
    offset,
  );
  return { items, total };
}

export function findReservation(id: number): Reservation | undefined {
  return row<ReservationRow>(getDb().prepare('SELECT id, patient_id, starts_at, ends_at, staff_id, room, purpose, note, status FROM reservation WHERE id = ?'), id);
}

function requireReservation(id: number): Reservation {
  const r = findReservation(id);
  if (!r) throw new ApiError('not_found');
  return r;
}

/** Every `booked` reservation touching the same staff member or room, for the conflict check. */
function candidatesFor(staffId: number, room: string): ReservationSlot[] {
  return rows<ReservationRow>(
    getDb().prepare("SELECT id, starts_at, ends_at, staff_id, room, status FROM reservation WHERE status = 'booked' AND (staff_id = ? OR room = ?)"),
    staffId,
    room,
  );
}

export type ReservationInput = {
  patient_id: unknown;
  starts_at: unknown;
  ends_at: unknown;
  staff_id: unknown;
  room: unknown;
  purpose?: unknown;
  note?: unknown;
};

function validateReservationInput(input: ReservationInput): {
  patient_id: number;
  starts_at: string;
  ends_at: string;
  staff_id: number;
  room: string;
  purpose: string;
  note: string;
} {
  const details = [];
  if (typeof input.patient_id !== 'number' || !Number.isInteger(input.patient_id)) {
    details.push({ field: 'patient_id', message: '患者（patient_id）は必須です。' });
  }
  if (typeof input.starts_at !== 'string' || input.starts_at.length === 0) {
    details.push({ field: 'starts_at', message: '開始時刻（starts_at）は必須です。' });
  }
  if (typeof input.ends_at !== 'string' || input.ends_at.length === 0) {
    details.push({ field: 'ends_at', message: '終了時刻（ends_at）は必須です。' });
  }
  if (typeof input.staff_id !== 'number' || !Number.isInteger(input.staff_id)) {
    details.push({ field: 'staff_id', message: '担当（staff_id）は必須です。' });
  }
  if (typeof input.room !== 'string' || input.room.length === 0) {
    details.push({ field: 'room', message: '処置室（room）は必須です。' });
  }
  if (details.length === 0 && !isValidSpan(input.starts_at as string, input.ends_at as string)) {
    details.push({ field: 'ends_at', message: '終了時刻（ends_at）は開始時刻（starts_at）より後である必要があります。' });
  }
  if (details.length > 0) throw new ApiError('invalid_input', details);

  return {
    patient_id: input.patient_id as number,
    starts_at: input.starts_at as string,
    ends_at: input.ends_at as string,
    staff_id: input.staff_id as number,
    room: input.room as string,
    purpose: (input.purpose as string | null | undefined) ?? '',
    note: (input.note as string | null | undefined) ?? '',
  };
}

export function createReservation(input: ReservationInput): Reservation {
  const v = validateReservationInput(input);
  if (!findPatientById(v.patient_id)) throw new ApiError('not_found');

  const conflict = findConflict(v, candidatesFor(v.staff_id, v.room));
  if (conflict) throw new ApiError('reservation_conflict');

  const info = getDb()
    .prepare("INSERT INTO reservation (patient_id, starts_at, ends_at, staff_id, room, purpose, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'booked')")
    .run(v.patient_id, v.starts_at, v.ends_at, v.staff_id, v.room, v.purpose, v.note);
  return requireReservation(Number(info.lastInsertRowid));
}

export function updateReservation(id: number, input: ReservationInput): Reservation {
  requireReservation(id);
  const v = validateReservationInput(input);
  if (!findPatientById(v.patient_id)) throw new ApiError('not_found');

  const conflict = findConflict(v, candidatesFor(v.staff_id, v.room), id);
  if (conflict) throw new ApiError('reservation_conflict');

  getDb()
    .prepare('UPDATE reservation SET patient_id = ?, starts_at = ?, ends_at = ?, staff_id = ?, room = ?, purpose = ?, note = ? WHERE id = ?')
    .run(v.patient_id, v.starts_at, v.ends_at, v.staff_id, v.room, v.purpose, v.note, id);
  return requireReservation(id);
}

export function cancelReservation(id: number): Reservation {
  requireReservation(id);
  getDb().prepare("UPDATE reservation SET status = 'cancelled' WHERE id = ?").run(id);
  return requireReservation(id);
}
