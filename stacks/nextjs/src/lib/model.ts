/**
 * Domain types, derived from `spec/model.md`.
 *
 * The spec fixes *what is held*, not *how*. This lane holds it in SQLite via
 * `node:sqlite` (see `db.ts`) and mirrors it here so every area of the app
 * agrees on one shape. Lane E writes this file itself rather than delegating
 * it: it is the seam the five screen areas meet at.
 *
 * Dates are ISO strings in JST (`DECISIONS.md` 4). `null` means "not set" and
 * is never silently turned into 0 or "".
 */

export type Id = number;
export type IsoDate = string; // YYYY-MM-DD
export type IsoDateTime = string; // YYYY-MM-DDTHH:mm:ss+09:00
export type IsoTime = string; // HH:mm

export type StaffRole = 'vet' | 'nurse' | 'office';
export type Sex = 'male' | 'female' | 'unknown';
export type ReceptionStatus = 'waiting' | 'in_exam' | 'done';
export type BillingStatus = 'draft' | 'confirmed';
export type ReservationStatus = 'booked' | 'cancelled';

/** 0 = Monday … 6 = Sunday (spec/model.md 1). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isWeekday(n: number): n is Weekday {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

/** Narrows a plain number array (e.g. parsed from JSON or a form) to `Weekday[]`, dropping anything out of range. */
export function toWeekdays(values: number[]): Weekday[] {
  return values.filter(isWeekday);
}

/** Rows that are marked rather than removed (spec/model.md「消さずに印を付ける」). */
export type SoftDeletable = { deleted_at: IsoDateTime | null };

export type Clinic = {
  id: Id;
  name: string;
  postal_code: string;
  address1: string;
  address2: string;
  phone: string;
  fax: string;
  director_name: string;
  reservation_slot_minutes: number;
  tax_rate: number;
  closed_weekdays: Weekday[];
};

export type Staff = {
  id: Id;
  staff_code: string;
  name: string;
  role: StaffRole;
  is_active: boolean;
  /** Never the plaintext password (spec/model.md 2). */
  password_hash: string;
};

export type Owner = SoftDeletable & {
  id: Id;
  owner_no: string;
  name_kana: string;
  name_kanji: string;
  postal_code: string;
  address1: string;
  address2: string;
  phone: string;
  mobile: string;
};

export type Patient = SoftDeletable & {
  id: Id;
  /** Appears in screen URLs (spec/model.md 4). */
  karte_no: string;
  owner_id: Id;
  name_kana: string;
  name_kanji: string;
  species: string;
  breed: string;
  sex: Sex;
  birth_date: IsoDate | null;
  neuter_date: IsoDate | null;
};

export type Reception = {
  id: Id;
  patient_id: Id;
  /** Changes when the row is moved up or down. */
  display_no: number;
  received_at: IsoDateTime;
  owner_purpose: string;
  medical_purpose: string;
  status: ReceptionStatus;
  staff_id: Id | null;
};

export type Visit = SoftDeletable & {
  id: Id;
  patient_id: Id;
  visit_no: string;
  visit_date: IsoDate;
  visit_time: IsoTime | null;
  body_weight_kg: number | null;
  chief_complaint: string;
  symptom: string;
  diagnosis: string;
  treatment: string;
  staff_id: Id | null;
};

export type ProgressNote = {
  id: Id;
  visit_id: Id;
  row_no: number;
  entry_date: IsoDate;
  /**
   * Per-patient value. The system this is modelled on once printed one fixed
   * temperature for every patient (spec/model.md 7); acceptance.md checks it.
   */
  temperature_c: number | null;
  pulse: number | null;
  respiration: number | null;
  body_weight_kg: number | null;
  symptom_course: string;
  treatment_rx: string;
  note: string;
};

export type Prevention = {
  id: Id;
  patient_id: Id;
  kind: string;
  content: string;
  performed_date: IsoDate | null;
  next_due_date: IsoDate | null;
};

export type Dosing = {
  id: Id;
  patient_id: Id;
  kind: string;
  fiscal_year: number;
  m01: string; m02: string; m03: string; m04: string; m05: string; m06: string;
  m07: string; m08: string; m09: string; m10: string; m11: string; m12: string;
};

export type LabTest = {
  id: Id;
  patient_id: Id;
  visit_id: Id | null;
  category: string;
  tested_on: IsoDate;
  tested_at_time: IsoTime | null;
  staff_id: Id | null;
};

export type LabTestItem = {
  id: Id;
  lab_test_id: Id;
  /** Points at fixed data in data/lab_items.json; reference ranges are not stored. */
  item_code: string;
  value_num: number | null;
  value_text: string | null;
};

export type Billing = {
  id: Id;
  patient_id: Id;
  owner_id: Id;
  slip_no: string;
  status: BillingStatus;
  billed_on: IsoDate;
  staff_id: Id | null;
  cashier_staff_id: Id | null;
  paid_amount: number | null;
  payment_method: string | null;
};

export type BillingDetail = {
  id: Id;
  billing_id: Id;
  row_no: number;
  price_code: string;
  name: string;
  quantity: number;
  /**
   * **`null` means the unit price is not set, and it must never be counted
   * as 0.** Show the total, and state how many rows were left out of it
   * (spec/README.md). This is the defect the spec is built around.
   */
  unit_price: number | null;
  is_taxable: boolean;
};

export type Reservation = {
  id: Id;
  patient_id: Id;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime;
  /**
   * The same staff member must not have overlapping slots. Required
   * (spec/openapi.yaml `Reservation`/`ReservationCreate`) -- unlike the
   * nullable `staff_id` on Visit/Reception/LabTest/Billing, an unassigned
   * reservation is not modelled.
   */
  staff_id: Id;
  /** The same room must not have overlapping slots. */
  room: string;
  purpose: string;
  note: string;
  status: ReservationStatus;
};

export type CareRecord = {
  id: Id;
  hospitalization_id: Id;
  row_no: number;
  recorded_at: IsoDateTime;
  category: string;
  content: string;
  /**
   * **Required.** A record with no one attached to it is not a record
   * (spec/model.md 15).
   */
  performed_by_staff_id: Id;
};

export type Hospitalization = {
  id: Id;
  patient_id: Id;
  admitted_on: IsoDate;
  discharged_on: IsoDate | null;
  room: string;
  care_records: CareRecord[];
};
