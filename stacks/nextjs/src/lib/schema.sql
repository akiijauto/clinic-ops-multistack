-- SQLite schema for lane E, derived from spec/model.md.
--
-- Two rules the spec singles out are enforced here rather than left to
-- application code, because application code is what got them wrong in the
-- system this is modelled on:
--
--   * billing_detail.unit_price is NULLable and NULL is NOT 0. Sums must
--     exclude those rows and report how many were excluded.
--   * care_record.performed_by_staff_id is NOT NULL. A care record with
--     nobody attached is not a record.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clinic (
  id                       INTEGER PRIMARY KEY,
  name                     TEXT    NOT NULL,
  postal_code              TEXT    NOT NULL DEFAULT '',
  address1                 TEXT    NOT NULL DEFAULT '',
  address2                 TEXT    NOT NULL DEFAULT '',
  phone                    TEXT    NOT NULL DEFAULT '',
  fax                      TEXT    NOT NULL DEFAULT '',
  director_name            TEXT    NOT NULL DEFAULT '',
  reservation_slot_minutes INTEGER NOT NULL DEFAULT 15,
  tax_rate                 REAL    NOT NULL DEFAULT 0.10,
  -- JSON array of weekdays, 0=Monday .. 6=Sunday.
  closed_weekdays          TEXT    NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS staff (
  id            INTEGER PRIMARY KEY,
  staff_code    TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('vet', 'nurse', 'office')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  password_hash TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS owner (
  id          INTEGER PRIMARY KEY,
  owner_no    TEXT    NOT NULL UNIQUE,
  name_kana   TEXT    NOT NULL DEFAULT '',
  name_kanji  TEXT    NOT NULL DEFAULT '',
  postal_code TEXT    NOT NULL DEFAULT '',
  address1    TEXT    NOT NULL DEFAULT '',
  address2    TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  mobile      TEXT    NOT NULL DEFAULT '',
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS patient (
  id          INTEGER PRIMARY KEY,
  karte_no    TEXT    NOT NULL UNIQUE,
  owner_id    INTEGER NOT NULL REFERENCES owner(id),
  name_kana   TEXT    NOT NULL DEFAULT '',
  name_kanji  TEXT    NOT NULL DEFAULT '',
  species     TEXT    NOT NULL DEFAULT '',
  breed       TEXT    NOT NULL DEFAULT '',
  sex         TEXT    NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
  birth_date  TEXT,
  neuter_date TEXT,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_patient_owner ON patient(owner_id);

CREATE TABLE IF NOT EXISTS reception (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patient(id),
  display_no      INTEGER NOT NULL,
  received_at     TEXT    NOT NULL,
  owner_purpose   TEXT    NOT NULL DEFAULT '',
  medical_purpose TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting', 'in_exam', 'done')),
  staff_id        INTEGER REFERENCES staff(id),
  -- Added by area1. spec/openapi.yaml's `/today` has a `kind` query param and
  -- spec/screens.md screen 1 requires a per-区分 tab, but neither
  -- spec/model.md's Reception model nor data/seed.json's reception rows carry
  -- any such field -- there is nothing to filter on. Rather than leave the
  -- tabs unimplementable, this column backs them; every existing seed row
  -- defaults to the first `data/masters.json` reception_kind
  -- (`first_visit`), and new receptions may pick any code from that list.
  -- Flagged to the team lead as a model.md/data gap, not silently patched
  -- into spec/.
  kind            TEXT    NOT NULL DEFAULT 'first_visit'
);
CREATE INDEX IF NOT EXISTS idx_reception_order ON reception(received_at, display_no);

CREATE TABLE IF NOT EXISTS visit (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patient(id),
  visit_no        TEXT    NOT NULL,
  visit_date      TEXT    NOT NULL,
  visit_time      TEXT,
  body_weight_kg  REAL,
  chief_complaint TEXT    NOT NULL DEFAULT '',
  symptom         TEXT    NOT NULL DEFAULT '',
  diagnosis       TEXT    NOT NULL DEFAULT '',
  treatment       TEXT    NOT NULL DEFAULT '',
  staff_id        INTEGER REFERENCES staff(id),
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_visit_patient ON visit(patient_id, visit_date);

CREATE TABLE IF NOT EXISTS progress_note (
  id             INTEGER PRIMARY KEY,
  visit_id       INTEGER NOT NULL REFERENCES visit(id),
  row_no         INTEGER NOT NULL,
  entry_date     TEXT    NOT NULL,
  -- Nullable on purpose: an unmeasured temperature is not 0 and not a shared
  -- fixed value. spec/model.md 7.
  temperature_c  REAL,
  pulse          INTEGER,
  respiration    INTEGER,
  body_weight_kg REAL,
  symptom_course TEXT    NOT NULL DEFAULT '',
  treatment_rx   TEXT    NOT NULL DEFAULT '',
  note           TEXT    NOT NULL DEFAULT '',
  UNIQUE (visit_id, row_no)
);

CREATE TABLE IF NOT EXISTS prevention (
  id             INTEGER PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES patient(id),
  kind           TEXT    NOT NULL,
  content        TEXT    NOT NULL DEFAULT '',
  performed_date TEXT,
  next_due_date  TEXT
);
CREATE INDEX IF NOT EXISTS idx_prevention_patient ON prevention(patient_id);

CREATE TABLE IF NOT EXISTS dosing (
  id          INTEGER PRIMARY KEY,
  patient_id  INTEGER NOT NULL REFERENCES patient(id),
  kind        TEXT    NOT NULL,
  fiscal_year INTEGER NOT NULL,
  m01 TEXT NOT NULL DEFAULT '', m02 TEXT NOT NULL DEFAULT '',
  m03 TEXT NOT NULL DEFAULT '', m04 TEXT NOT NULL DEFAULT '',
  m05 TEXT NOT NULL DEFAULT '', m06 TEXT NOT NULL DEFAULT '',
  m07 TEXT NOT NULL DEFAULT '', m08 TEXT NOT NULL DEFAULT '',
  m09 TEXT NOT NULL DEFAULT '', m10 TEXT NOT NULL DEFAULT '',
  m11 TEXT NOT NULL DEFAULT '', m12 TEXT NOT NULL DEFAULT '',
  UNIQUE (patient_id, kind, fiscal_year)
);

CREATE TABLE IF NOT EXISTS lab_test (
  id             INTEGER PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES patient(id),
  visit_id       INTEGER REFERENCES visit(id),
  category       TEXT    NOT NULL DEFAULT '',
  tested_on      TEXT    NOT NULL,
  tested_at_time TEXT,
  staff_id       INTEGER REFERENCES staff(id)
);
CREATE INDEX IF NOT EXISTS idx_lab_test_patient ON lab_test(patient_id, tested_on);

CREATE TABLE IF NOT EXISTS lab_test_item (
  id          INTEGER PRIMARY KEY,
  lab_test_id INTEGER NOT NULL REFERENCES lab_test(id),
  item_code   TEXT    NOT NULL,
  value_num   REAL,
  value_text  TEXT
);
CREATE INDEX IF NOT EXISTS idx_lab_test_item_test ON lab_test_item(lab_test_id);

CREATE TABLE IF NOT EXISTS billing (
  id                INTEGER PRIMARY KEY,
  patient_id        INTEGER NOT NULL REFERENCES patient(id),
  owner_id          INTEGER NOT NULL REFERENCES owner(id),
  slip_no           TEXT    NOT NULL UNIQUE,
  status            TEXT    NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'confirmed')),
  billed_on         TEXT    NOT NULL,
  staff_id          INTEGER REFERENCES staff(id),
  cashier_staff_id  INTEGER REFERENCES staff(id),
  paid_amount       INTEGER,
  payment_method    TEXT
);
CREATE INDEX IF NOT EXISTS idx_billing_billed_on ON billing(billed_on);

CREATE TABLE IF NOT EXISTS billing_detail (
  id         INTEGER PRIMARY KEY,
  billing_id INTEGER NOT NULL REFERENCES billing(id),
  row_no     INTEGER NOT NULL,
  price_code TEXT    NOT NULL DEFAULT '',
  name       TEXT    NOT NULL DEFAULT '',
  quantity   REAL    NOT NULL DEFAULT 1,
  -- NULL = the unit price is not set. NULL is not 0. Totals must skip these
  -- rows, and the screen must say how many were skipped.
  unit_price INTEGER,
  is_taxable INTEGER NOT NULL DEFAULT 1 CHECK (is_taxable IN (0, 1)),
  UNIQUE (billing_id, row_no)
);

CREATE TABLE IF NOT EXISTS reservation (
  id         INTEGER PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  starts_at  TEXT    NOT NULL,
  ends_at    TEXT    NOT NULL,
  -- NOT NULL per spec/openapi.yaml Reservation/ReservationCreate (unlike the
  -- nullable staff_id elsewhere): an unassigned reservation is not modelled.
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  room       TEXT    NOT NULL DEFAULT '',
  purpose    TEXT    NOT NULL DEFAULT '',
  note       TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'booked'
                     CHECK (status IN ('booked', 'cancelled')),
  CHECK (ends_at > starts_at)
);
-- Overlap itself cannot be expressed as a SQLite constraint; it is checked in
-- the reservation service. These indexes make that check cheap.
CREATE INDEX IF NOT EXISTS idx_reservation_staff ON reservation(staff_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_reservation_room  ON reservation(room, starts_at);

CREATE TABLE IF NOT EXISTS hospitalization (
  id            INTEGER PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patient(id),
  admitted_on   TEXT    NOT NULL,
  discharged_on TEXT,
  room          TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_hospitalization_patient ON hospitalization(patient_id);

-- Added by area1 (受付・患者). Not one of the 14 modelled entities in
-- spec/model.md -- model.md explicitly drops a generic AuditLog ("業務では
-- 重要だが、5実装で比べる題材にはならない"), but spec/screens.md screen 5
-- (来院履歴) requires exactly this for Owner/Patient/Visit: who did what,
-- when, why, and the before/after values. That is a real conflict between
-- the two spec documents (reported in area1's final report rather than by
-- editing spec/ or coordination/, per spec/README.md「凍結」). This table is
-- the minimal, area1-scoped answer: it only ever holds history area1's own
-- routes write (owner/patient create/update/delete/restore, visit
-- delete/restore). It is additive and does not change any existing table.
CREATE TABLE IF NOT EXISTS history_entry (
  id          INTEGER PRIMARY KEY,
  entity_type TEXT    NOT NULL CHECK (entity_type IN ('owner', 'patient', 'visit')),
  entity_id   INTEGER NOT NULL,
  karte_no    TEXT,
  owner_no    TEXT,
  action      TEXT    NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  occurred_at TEXT    NOT NULL,
  staff_id    INTEGER REFERENCES staff(id),
  reason      TEXT,
  -- JSON array of {field, before, after}; empty array for create/delete/restore
  -- (the row itself is the "change" there).
  changes     TEXT    NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_history_karte ON history_entry(karte_no, occurred_at);
CREATE INDEX IF NOT EXISTS idx_history_owner ON history_entry(owner_no, occurred_at);

CREATE TABLE IF NOT EXISTS care_record (
  id                    INTEGER PRIMARY KEY,
  hospitalization_id    INTEGER NOT NULL REFERENCES hospitalization(id),
  row_no                INTEGER NOT NULL,
  recorded_at           TEXT    NOT NULL,
  -- data/seed.json calls this "category", not "kind". The fixture is the
  -- contract's own data, so the column follows it.
  category              TEXT    NOT NULL DEFAULT '',
  content               TEXT    NOT NULL DEFAULT '',
  -- NOT NULL on purpose. spec/model.md 15.
  performed_by_staff_id INTEGER NOT NULL REFERENCES staff(id),
  UNIQUE (hospitalization_id, row_no)
);

-- ------------------------------------------------------------------------
-- paper / patient_no_paper -- added by area 2 (screen 13, 書類).
--
-- Not one of spec/model.md's 14 kept entities -- model.md 「落としたもの」
-- lists KartePdf as intentionally dropped, and data/seed.json has no
-- "papers" fixture. But spec/screens.md screen 13 and spec/openapi.yaml
-- (`/animals/{karte_no}/papers`, `/papers/{paper_id}`, `/api/patients/
-- {karte_no}/papers`, `/api/papers/{paper_id}`) fully specify it as a
-- working (state A) screen, and spec/acceptance.md has no automated check
-- for it either way. Treated screens.md/openapi.yaml as the newer, binding
-- word (screens.md's own preamble: this is the shape the 26 screens are
-- converging on) and implemented it for real. Flagged for the coordinator
-- as a proposed addition to the shared schema/model -- see final report.
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paper (
  id          INTEGER PRIMARY KEY,
  patient_id  INTEGER NOT NULL REFERENCES patient(id),
  -- NULL = attached to the animal as a whole ("動物ぜんぶ"); set = attached
  -- to one Visit ("特定の診察").
  visit_id    INTEGER REFERENCES visit(id),
  title       TEXT    NOT NULL DEFAULT '',
  filename    TEXT    NOT NULL,
  period      TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  -- Logical delete only ("取り消し"). The row and its content are kept.
  removed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_paper_patient ON paper(patient_id);

-- Existence of a row = "この子の紙カルテは元から無い" is set for the patient.
CREATE TABLE IF NOT EXISTS patient_no_paper (
  patient_id INTEGER PRIMARY KEY REFERENCES patient(id),
  set_at     TEXT NOT NULL
);
