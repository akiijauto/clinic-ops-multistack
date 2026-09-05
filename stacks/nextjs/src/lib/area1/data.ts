import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db.ts';
import { one, many } from './query.ts';
import { nowJstIso, todayJst, jstDayBoundsAsJstIso } from '../jst.ts';
import { nextKarteNo, nextOwnerNo, karteNoExists, ownerNoExists } from './numbering.ts';
import { recordHistory, diffFields } from './history.ts';
import type { Owner, Patient, Reception, Visit, ProgressNote } from '../model.ts';

export function db(): DatabaseSync {
  return getDb();
}

// ---------------------------------------------------------------- Owner ----

export function getOwnerByNo(d: DatabaseSync, ownerNo: string): Owner | undefined {
  return one<Owner>(d.prepare('SELECT * FROM owner WHERE owner_no = ?'), ownerNo);
}

export function getOwnerById(d: DatabaseSync, id: number): Owner | undefined {
  return one<Owner>(d.prepare('SELECT * FROM owner WHERE id = ?'), id);
}

export type OwnerInput = {
  name_kana: string;
  name_kanji: string;
  postal_code: string;
  address1: string;
  address2: string;
  phone: string;
  mobile: string;
};

export type PatientInput = {
  name_kana: string;
  name_kanji: string;
  species: string;
  breed: string;
  sex: 'male' | 'female' | 'unknown';
  birth_date: string | null;
  neuter_date: string | null;
};

/** Screen 2 (新規登録): a fresh Owner and its first Patient, in one save. */
export function createOwnerAndPatient(
  d: DatabaseSync,
  owner: OwnerInput,
  patient: PatientInput,
  staffId: number | null,
): { owner: Owner; patient: Patient } {
  const ownerNo = nextOwnerNo(d);
  d.prepare(
    `INSERT INTO owner (owner_no, name_kana, name_kanji, postal_code, address1, address2, phone, mobile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(ownerNo, owner.name_kana, owner.name_kanji, owner.postal_code, owner.address1, owner.address2, owner.phone, owner.mobile);
  const ownerRow = getOwnerByNo(d, ownerNo)!;
  recordHistory(d, { entityType: 'owner', entityId: ownerRow.id, ownerNo, action: 'create', staffId });

  const p = addPatientToOwner(d, ownerRow, patient, staffId);
  return { owner: ownerRow, patient: p };
}

/** Screen 2, existing-owner path: add a second (or later) animal to an existing飼主. */
export function addPatientToOwner(d: DatabaseSync, owner: Owner, patient: PatientInput, staffId: number | null): Patient {
  const karteNo = nextKarteNo(d);
  d.prepare(
    `INSERT INTO patient (karte_no, owner_id, name_kana, name_kanji, species, breed, sex, birth_date, neuter_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(karteNo, owner.id, patient.name_kana, patient.name_kanji, patient.species, patient.breed, patient.sex, patient.birth_date, patient.neuter_date);
  const row = getPatientByKarteNo(d, karteNo)!;
  recordHistory(d, { entityType: 'patient', entityId: row.id, karteNo, ownerNo: owner.owner_no, action: 'create', staffId });
  return row;
}

export function updateOwner(d: DatabaseSync, ownerNo: string, input: OwnerInput, staffId: number | null): Owner | undefined {
  const before = getOwnerByNo(d, ownerNo);
  if (!before) return undefined;
  d.prepare(
    `UPDATE owner SET name_kana = ?, name_kanji = ?, postal_code = ?, address1 = ?, address2 = ?, phone = ?, mobile = ?
     WHERE owner_no = ?`,
  ).run(input.name_kana, input.name_kanji, input.postal_code, input.address1, input.address2, input.phone, input.mobile, ownerNo);
  const after = getOwnerByNo(d, ownerNo)!;
  const changes = diffFields(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
  if (changes.length > 0) {
    recordHistory(d, { entityType: 'owner', entityId: after.id, ownerNo, action: 'update', staffId, changes });
  }
  return after;
}

/** Screen 3 「飼主削除」. `Owner`/`Patient` are never physically removed (spec/model.md「消さずに印を付ける」). */
export function deleteOwner(d: DatabaseSync, ownerNo: string, staffId: number | null, reason?: string | null): Owner | undefined {
  const before = getOwnerByNo(d, ownerNo);
  if (!before || before.deleted_at) return before;
  const ts = nowJstIso();
  d.prepare('UPDATE owner SET deleted_at = ? WHERE owner_no = ?').run(ts, ownerNo);
  const after = getOwnerByNo(d, ownerNo)!;
  recordHistory(d, { entityType: 'owner', entityId: after.id, ownerNo, action: 'delete', staffId, reason });
  return after;
}

// -------------------------------------------------------------- Patient ----

export function getPatientByKarteNo(d: DatabaseSync, karteNo: string): Patient | undefined {
  return one<Patient>(d.prepare('SELECT * FROM patient WHERE karte_no = ?'), karteNo);
}

export function getPatientWithOwner(d: DatabaseSync, karteNo: string): (Patient & { owner: Owner }) | undefined {
  const patient = getPatientByKarteNo(d, karteNo);
  if (!patient) return undefined;
  const owner = getOwnerById(d, patient.owner_id);
  if (!owner) return undefined;
  return { ...patient, owner };
}

export function updatePatient(d: DatabaseSync, karteNo: string, input: PatientInput, staffId: number | null): Patient | undefined {
  const before = getPatientByKarteNo(d, karteNo);
  if (!before) return undefined;
  d.prepare(
    `UPDATE patient SET name_kana = ?, name_kanji = ?, species = ?, breed = ?, sex = ?, birth_date = ?, neuter_date = ?
     WHERE karte_no = ?`,
  ).run(input.name_kana, input.name_kanji, input.species, input.breed, input.sex, input.birth_date, input.neuter_date, karteNo);
  const after = getPatientByKarteNo(d, karteNo)!;
  const changes = diffFields(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
  if (changes.length > 0) {
    const owner = getOwnerById(d, after.owner_id);
    recordHistory(d, { entityType: 'patient', entityId: after.id, karteNo, ownerNo: owner?.owner_no, action: 'update', staffId, changes });
  }
  return after;
}

/**
 * Screen 3 「動物削除」 / screen 5 「削除（確認画面）」の実行部分.
 * openapi `/animals/{karte_no}/delete`: "この動物がその飼主の最後の1頭なら
 * Owner.deleted_at にも日時を入れる".
 */
export function deletePatient(d: DatabaseSync, karteNo: string, staffId: number | null, reason?: string | null): Patient | undefined {
  const before = getPatientByKarteNo(d, karteNo);
  if (!before) return undefined;
  if (!before.deleted_at) {
    const ts = nowJstIso();
    d.prepare('UPDATE patient SET deleted_at = ? WHERE karte_no = ?').run(ts, karteNo);
    const owner = getOwnerById(d, before.owner_id);
    recordHistory(d, { entityType: 'patient', entityId: before.id, karteNo, ownerNo: owner?.owner_no, action: 'delete', staffId, reason });

    const siblingsLeft = one<{ n: number }>(
      d.prepare('SELECT COUNT(*) AS n FROM patient WHERE owner_id = ? AND deleted_at IS NULL'),
      before.owner_id,
    );
    if (owner && !owner.deleted_at && (siblingsLeft?.n ?? 0) === 0) {
      d.prepare('UPDATE owner SET deleted_at = ? WHERE id = ?').run(ts, owner.id);
      recordHistory(d, { entityType: 'owner', entityId: owner.id, ownerNo: owner.owner_no, action: 'delete', staffId, reason: '最後の1頭の削除に伴う自動削除' });
    }
  }
  return getPatientByKarteNo(d, karteNo);
}

export function restorePatient(d: DatabaseSync, karteNo: string, staffId: number | null, reason?: string | null): Patient | undefined {
  const before = getPatientByKarteNo(d, karteNo);
  if (!before) return undefined;
  if (before.deleted_at) {
    d.prepare('UPDATE patient SET deleted_at = NULL WHERE karte_no = ?').run(karteNo);
    const owner = getOwnerById(d, before.owner_id);
    recordHistory(d, { entityType: 'patient', entityId: before.id, karteNo, ownerNo: owner?.owner_no, action: 'restore', staffId, reason });
  }
  return getPatientByKarteNo(d, karteNo);
}

/** Screen 3 「番号変更」. Rejects (returns `false`) if the target number is already used. */
export function changeKarteNo(d: DatabaseSync, oldKarteNo: string, newKarteNo: string, staffId: number | null): boolean {
  if (oldKarteNo === newKarteNo) return true;
  if (karteNoExists(d, newKarteNo)) return false;
  const before = getPatientByKarteNo(d, oldKarteNo);
  if (!before) return false;
  d.prepare('UPDATE patient SET karte_no = ? WHERE karte_no = ?').run(newKarteNo, oldKarteNo);
  const owner = getOwnerById(d, before.owner_id);
  recordHistory(d, {
    entityType: 'patient',
    entityId: before.id,
    karteNo: newKarteNo,
    ownerNo: owner?.owner_no,
    action: 'update',
    staffId,
    changes: [{ field: 'karte_no', before: oldKarteNo, after: newKarteNo }],
  });
  return true;
}

export function changeOwnerNo(d: DatabaseSync, oldOwnerNo: string, newOwnerNo: string, staffId: number | null): boolean {
  if (oldOwnerNo === newOwnerNo) return true;
  if (ownerNoExists(d, newOwnerNo)) return false;
  const before = getOwnerByNo(d, oldOwnerNo);
  if (!before) return false;
  d.prepare('UPDATE owner SET owner_no = ? WHERE owner_no = ?').run(newOwnerNo, oldOwnerNo);
  recordHistory(d, {
    entityType: 'owner',
    entityId: before.id,
    ownerNo: newOwnerNo,
    action: 'update',
    staffId,
    changes: [{ field: 'owner_no', before: oldOwnerNo, after: newOwnerNo }],
  });
  return true;
}

/** Screen 3 「品種リスト」. No breed master ships in `data/`, so this is derived from what other patients of the same species already used. */
export function breedCandidates(d: DatabaseSync, species: string): string[] {
  const rows = many<{ breed: string }>(
    d.prepare('SELECT DISTINCT breed FROM patient WHERE species = ? AND breed != ? ORDER BY breed'),
    species,
    '',
  );
  return rows.map((r) => r.breed);
}

// -------------------------------------------------------------- Search -----

export type PatientSearchRow = Patient & { owner_no: string; owner_name_kana: string; owner_name_kanji: string; owner_phone: string };

export function searchPatientsOwners(d: DatabaseSync, q: string, includeDeleted: boolean): PatientSearchRow[] {
  const like = `%${q}%`;
  const deletedClause = includeDeleted ? '' : 'AND p.deleted_at IS NULL AND o.deleted_at IS NULL';
  return many<PatientSearchRow>(
    d.prepare(
      `SELECT p.*, o.owner_no AS owner_no, o.name_kana AS owner_name_kana, o.name_kanji AS owner_name_kanji, o.phone AS owner_phone
       FROM patient p JOIN owner o ON o.id = p.owner_id
       WHERE (p.name_kana LIKE ? OR p.name_kanji LIKE ? OR p.karte_no LIKE ?
              OR o.name_kana LIKE ? OR o.name_kanji LIKE ? OR o.phone LIKE ? OR o.mobile LIKE ?)
       ${deletedClause}
       ORDER BY p.karte_no`,
    ),
    like, like, like, like, like, like, like,
  );
}

export type VisitSearchRow = Visit & { karte_no: string; patient_name_kanji: string; matched_field: string; matched_text: string };

export function searchVisits(d: DatabaseSync, q: string): VisitSearchRow[] {
  const like = `%${q}%`;
  const fields: Array<[string, string]> = [
    ['chief_complaint', '主訴'],
    ['symptom', '現症'],
    ['diagnosis', '病名'],
    ['treatment', '処置'],
  ];
  const out: VisitSearchRow[] = [];
  for (const [col, label] of fields) {
    const found = many<Visit & { karte_no: string; patient_name_kanji: string }>(
      d.prepare(
        `SELECT v.*, p.karte_no AS karte_no, p.name_kanji AS patient_name_kanji
         FROM visit v JOIN patient p ON p.id = v.patient_id
         WHERE v.${col} LIKE ? AND v.deleted_at IS NULL AND p.deleted_at IS NULL
         ORDER BY v.visit_date DESC`,
      ),
      like,
    );
    for (const row of found) out.push({ ...row, matched_field: label, matched_text: excerpt((row as unknown as Record<string, string>)[col] ?? '', q) });
  }
  return out;
}

function excerpt(text: string, q: string, context = 10): string {
  const i = text.indexOf(q);
  if (i < 0) return text.slice(0, context * 2);
  const start = Math.max(0, i - context);
  const end = Math.min(text.length, i + q.length + context);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

// ------------------------------------------------------------ Reception ----

export function listReceptionsForDay(d: DatabaseSync, dateJst: string): (Reception & { kind: string })[] {
  const { startIso, endIso } = jstDayBoundsAsJstIso(dateJst);
  return many<Reception & { kind: string }>(
    d.prepare(`SELECT * FROM reception WHERE received_at >= ? AND received_at < ? ORDER BY display_no ASC`),
    startIso,
    endIso,
  );
}

export function getReception(d: DatabaseSync, id: number): (Reception & { kind: string }) | undefined {
  return one(d.prepare('SELECT * FROM reception WHERE id = ?'), id);
}

export function createReception(
  d: DatabaseSync,
  input: { patient_id: number; owner_purpose: string; medical_purpose: string; kind: string; staff_id: number | null },
): Reception & { kind: string } {
  const today = todayJst();
  const nextNo = one<{ n: number }>(d.prepare('SELECT COALESCE(MAX(display_no), 0) + 1 AS n FROM reception'))!.n;
  d.prepare(
    `INSERT INTO reception (patient_id, display_no, received_at, owner_purpose, medical_purpose, status, staff_id, kind)
     VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)`,
  ).run(input.patient_id, nextNo, nowJstIso(), input.owner_purpose, input.medical_purpose, input.staff_id, input.kind);
  void today;
  return getReception(d, one<{ id: number }>(d.prepare('SELECT last_insert_rowid() AS id'))!.id)!;
}

export function updateReception(
  d: DatabaseSync,
  id: number,
  patch: Partial<{ status: Reception['status']; staff_id: number | null; display_no: number; owner_purpose: string; medical_purpose: string; kind: string }>,
): (Reception & { kind: string }) | undefined {
  const before = getReception(d, id);
  if (!before) return undefined;
  const merged = { ...before, ...patch };
  d.prepare(
    `UPDATE reception SET status = ?, staff_id = ?, display_no = ?, owner_purpose = ?, medical_purpose = ?, kind = ? WHERE id = ?`,
  ).run(merged.status, merged.staff_id, merged.display_no, merged.owner_purpose, merged.medical_purpose, merged.kind, id);
  return getReception(d, id);
}

/** Screen 1 「上へ／下へ」: swap `display_no` with the adjacent row for the *whole day* (kind/hide filters don't change adjacency -- spec: 他の行の順序は変わらない). */
export function moveReception(d: DatabaseSync, id: number, direction: 'up' | 'down'): boolean {
  const target = getReception(d, id);
  if (!target) return false;
  const neighbor =
    direction === 'up'
      ? one<Reception>(d.prepare('SELECT * FROM reception WHERE display_no < ? ORDER BY display_no DESC LIMIT 1'), target.display_no)
      : one<Reception>(d.prepare('SELECT * FROM reception WHERE display_no > ? ORDER BY display_no ASC LIMIT 1'), target.display_no);
  if (!neighbor) return false;
  d.prepare('UPDATE reception SET display_no = ? WHERE id = ?').run(neighbor.display_no, target.id);
  d.prepare('UPDATE reception SET display_no = ? WHERE id = ?').run(target.display_no, neighbor.id);
  return true;
}

/** `visit_count.today`: counts every Visit for the date, deleted or not (acceptance 検算9). */
export function visitCountForDate(d: DatabaseSync, dateJst: string): number {
  return one<{ n: number }>(d.prepare('SELECT COUNT(*) AS n FROM visit WHERE visit_date = ?'), dateJst)!.n;
}

// ---------------------------------------------------------------- Visit ----

export function getVisit(d: DatabaseSync, visitId: number): Visit | undefined {
  return one<Visit>(d.prepare('SELECT * FROM visit WHERE id = ?'), visitId);
}

export function getVisitWithNotes(d: DatabaseSync, visitId: number): (Visit & { progress_notes: ProgressNote[] }) | undefined {
  const visit = getVisit(d, visitId);
  if (!visit) return undefined;
  const notes = many<ProgressNote>(d.prepare('SELECT * FROM progress_note WHERE visit_id = ? ORDER BY row_no'), visitId);
  return { ...visit, progress_notes: notes };
}

export function listVisitsForKarteNo(d: DatabaseSync, karteNo: string, includeDeleted: boolean): Visit[] {
  const patient = getPatientByKarteNo(d, karteNo);
  if (!patient) return [];
  const clause = includeDeleted ? '' : 'AND deleted_at IS NULL';
  return many<Visit>(d.prepare(`SELECT * FROM visit WHERE patient_id = ? ${clause} ORDER BY visit_date DESC, id DESC`), patient.id);
}

/** Screen 6 「削除」: 理由は必須（openapi にモデルは無いが screens.md が要求する。history_entry.reason に記録）. */
export function deleteVisit(d: DatabaseSync, visitId: number, staffId: number | null, reason: string): Visit | undefined {
  const before = getVisit(d, visitId);
  if (!before) return undefined;
  if (!before.deleted_at) {
    d.prepare('UPDATE visit SET deleted_at = ? WHERE id = ?').run(nowJstIso(), visitId);
    const patient = getPatientById(d, before.patient_id);
    recordHistory(d, { entityType: 'visit', entityId: visitId, karteNo: patient?.karte_no, action: 'delete', staffId, reason });
  }
  return getVisit(d, visitId);
}

export function restoreVisit(d: DatabaseSync, visitId: number, staffId: number | null, reason?: string | null): Visit | undefined {
  const before = getVisit(d, visitId);
  if (!before) return undefined;
  if (before.deleted_at) {
    d.prepare('UPDATE visit SET deleted_at = NULL WHERE id = ?').run(visitId);
    const patient = getPatientById(d, before.patient_id);
    recordHistory(d, { entityType: 'visit', entityId: visitId, karteNo: patient?.karte_no, action: 'restore', staffId, reason });
  }
  return getVisit(d, visitId);
}

export function getPatientById(d: DatabaseSync, id: number): Patient | undefined {
  return one<Patient>(d.prepare('SELECT * FROM patient WHERE id = ?'), id);
}

/** Deleted Visits for an animal, for screen 5's「削除した診察の一覧（復元の入口）」. */
export function listDeletedVisitsForKarteNo(d: DatabaseSync, karteNo: string): Visit[] {
  const patient = getPatientByKarteNo(d, karteNo);
  if (!patient) return [];
  return many<Visit>(d.prepare('SELECT * FROM visit WHERE patient_id = ? AND deleted_at IS NOT NULL ORDER BY visit_date DESC'), patient.id);
}

// -------------------------------------------------------------- Billing ----

/** 顧客画面の「未収金・内金の有無」要約. Rough on purpose -- the authoritative rounding rules (acceptance「数値の規則」) belong to area3's billing screens; this is a summary, not a検算 target. */
export function billingSummaryForPatient(d: DatabaseSync, patientId: number): { unpaidBillingCount: number; hasAnyUnpaid: boolean } {
  const billings = many<{ id: number; paid_amount: number | null }>(
    d.prepare(`SELECT id, paid_amount FROM billing WHERE patient_id = ? AND status = 'confirmed'`),
    patientId,
  );
  let unpaidBillingCount = 0;
  for (const b of billings) {
    const details = many<{ quantity: number; unit_price: number | null }>(
      d.prepare('SELECT quantity, unit_price FROM billing_detail WHERE billing_id = ?'),
      b.id,
    );
    const total = details.reduce((sum, row) => (row.unit_price === null ? sum : sum + row.quantity * row.unit_price), 0);
    const paid = b.paid_amount ?? 0;
    if (paid < total) unpaidBillingCount += 1;
  }
  return { unpaidBillingCount, hasAnyUnpaid: unpaidBillingCount > 0 };
}
