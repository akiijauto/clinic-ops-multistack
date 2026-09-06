"""14モデル。`spec/model.md` が正。

**統合点なのでレーン本体（自分）が書く。** 領域ごとのサブエージェントはここを
インポートするだけで、書き換えない。

設計判断（後で語れるようにするための記録）:

- **物理削除しない3モデル**（`Owner` `Patient` `Visit`）は `deleted_at` を持つ。
  クエリは既定で `deleted_at IS NULL` に絞る。**集計系のクエリは絞らない**
  （検算9：削除しても件数・金額は変わらない）。この線引きを間違えると検算9が割れる
- **`Hospitalization.care_records` は別テーブル**（`CareRecord`）にした。
  JSON列に埋め込む案もあったが、「実施者が空の行を作れない」という業務ルールを
  型（NOT NULL制約）で支えられるのは別テーブルのときだけ
- 金額は **Integer**（円未満は生じない契約）。数量・単価は割り切れない場合があるため
  Numeric で持ち、丸めは表示直前の1回だけ（`app/billing_calc.py` に集約）
- 予約の重なり判定・入院記録の実施者必須は型で弾けない
  （他行を見て初めて分かる／NULL入力を拒否するだけでは「必須」の全部にならない）ため、
  各ルーターの業務検証で行う。ここでは performed_by_staff_id を NOT NULL にして
  型の側でも最低限は支える
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# -- 1. Clinic -- 病院（1件だけ） --------------------------------------------

class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    postal_code: Mapped[str] = mapped_column(String(20), default="")
    address1: Mapped[str] = mapped_column(String(200), default="")
    address2: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    fax: Mapped[str] = mapped_column(String(30), default="")
    director_name: Mapped[str] = mapped_column(String(100), default="")
    reservation_slot_minutes: Mapped[int] = mapped_column(Integer, default=15)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.10)
    # 休診日（0=月…6=日）はカンマ区切りの文字列で持つ。SQLiteに配列型が無いため。
    # アクセスは models.py のプロパティ越し（各レーンが独自にCSVを解釈し直さないように）。
    closed_weekdays_csv: Mapped[str] = mapped_column(String(20), default="")

    @property
    def closed_weekdays(self) -> list[int]:
        if not self.closed_weekdays_csv:
            return []
        return [int(x) for x in self.closed_weekdays_csv.split(",") if x != ""]

    @closed_weekdays.setter
    def closed_weekdays(self, days: list[int]) -> None:
        self.closed_weekdays_csv = ",".join(str(d) for d in sorted(set(days)))


# -- 2. Staff -- スタッフ -----------------------------------------------------

class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20))  # vet / nurse / office
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # ログインは扱わない（DECISIONS 第4節）が、seed.json に元々あるので列は保持する。
    # 画面には出さない・送信しない（spec/screens.md 21「スタッフ」満たすべきこと）。
    password_hash: Mapped[str] = mapped_column(String(200), default="")


# -- 3. Owner -- 飼主 ---------------------------------------------------------

class Owner(Base):
    __tablename__ = "owners"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_no: Mapped[str] = mapped_column(String(20), unique=True)
    name_kana: Mapped[str] = mapped_column(String(100), default="")
    name_kanji: Mapped[str] = mapped_column(String(100))
    postal_code: Mapped[str] = mapped_column(String(20), default="")
    address1: Mapped[str] = mapped_column(String(200), default="")
    address2: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    mobile: Mapped[str] = mapped_column(String(30), default="")
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    patients: Mapped[list["Patient"]] = relationship(back_populates="owner")


# -- 4. Patient -- 動物 -------------------------------------------------------

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    karte_no: Mapped[str] = mapped_column(String(20), unique=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"))
    name_kana: Mapped[str] = mapped_column(String(100), default="")
    name_kanji: Mapped[str] = mapped_column(String(100))
    species: Mapped[str] = mapped_column(String(20))  # dog / cat / other 相当の自由記述
    breed: Mapped[str] = mapped_column(String(100), default="")
    sex: Mapped[str] = mapped_column(String(20))  # male / female / unknown
    birth_date: Mapped[dt.date | None] = mapped_column(Date, default=None)
    neuter_date: Mapped[dt.date | None] = mapped_column(Date, default=None)
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    # 「この子の紙カルテは元から無い」の印（screens.md 13番「書類」）。
    # 「まだ取り込んでいない」（Paperの行が0件）と区別するための独立したフラグ。
    no_paper: Mapped[bool] = mapped_column(Boolean, default=False)

    owner: Mapped["Owner"] = relationship(back_populates="patients")


# -- 5. Reception -- 本日の患者（受付） ---------------------------------------

class Reception(Base):
    __tablename__ = "receptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    display_no: Mapped[int] = mapped_column(Integer)
    received_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    owner_purpose: Mapped[str] = mapped_column(String(200), default="")
    medical_purpose: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(20), default="waiting")  # waiting/in_exam/done
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)


# -- 6. Visit -- 診察 ----------------------------------------------------------

class Visit(Base):
    __tablename__ = "visits"
    __table_args__ = (UniqueConstraint("patient_id", "visit_no", name="uq_visit_patient_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    visit_no: Mapped[int] = mapped_column(Integer)
    visit_date: Mapped[dt.date] = mapped_column(Date)
    visit_time: Mapped[str] = mapped_column(String(10), default="")
    body_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), default=None)
    chief_complaint: Mapped[str] = mapped_column(String(500), default="")
    symptom: Mapped[str] = mapped_column(String(500), default="")
    diagnosis: Mapped[str] = mapped_column(String(500), default="")
    treatment: Mapped[str] = mapped_column(String(500), default="")
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    progress_notes: Mapped[list["ProgressNote"]] = relationship(
        back_populates="visit", order_by="ProgressNote.row_no"
    )


# -- 7. ProgressNote -- 経過記録 ------------------------------------------------

class ProgressNote(Base):
    __tablename__ = "progress_notes"
    __table_args__ = (UniqueConstraint("visit_id", "row_no", name="uq_note_visit_row"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"))
    row_no: Mapped[int] = mapped_column(Integer)
    entry_date: Mapped[dt.date] = mapped_column(Date)
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1), default=None)
    pulse: Mapped[int | None] = mapped_column(Integer, default=None)
    respiration: Mapped[int | None] = mapped_column(Integer, default=None)
    body_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), default=None)
    symptom_course: Mapped[str] = mapped_column(String(1000), default="")
    treatment_rx: Mapped[str] = mapped_column(String(1000), default="")
    note: Mapped[str] = mapped_column(String(1000), default="")

    visit: Mapped["Visit"] = relationship(back_populates="progress_notes")


# -- 8. Prevention -- 予防 -----------------------------------------------------

class Prevention(Base):
    __tablename__ = "preventions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    kind: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(String(200), default="")
    performed_date: Mapped[dt.date] = mapped_column(Date)
    next_due_date: Mapped[dt.date | None] = mapped_column(Date, default=None)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)


# -- 9. Dosing -- 投薬（年度×月） ----------------------------------------------

class Dosing(Base):
    __tablename__ = "dosings"
    __table_args__ = (
        UniqueConstraint("patient_id", "kind", "fiscal_year", name="uq_dosing_patient_kind_year"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    kind: Mapped[str] = mapped_column(String(50))
    fiscal_year: Mapped[int] = mapped_column(Integer)
    # 値は "" (送られなかった) / "○" (実施) / "×" (実施しないと決めた) の3状態。
    # 「送られなかった月」と「外した月」を混同しないこと（spec/screens.md 11）。
    m01: Mapped[str] = mapped_column(String(4), default="")
    m02: Mapped[str] = mapped_column(String(4), default="")
    m03: Mapped[str] = mapped_column(String(4), default="")
    m04: Mapped[str] = mapped_column(String(4), default="")
    m05: Mapped[str] = mapped_column(String(4), default="")
    m06: Mapped[str] = mapped_column(String(4), default="")
    m07: Mapped[str] = mapped_column(String(4), default="")
    m08: Mapped[str] = mapped_column(String(4), default="")
    m09: Mapped[str] = mapped_column(String(4), default="")
    m10: Mapped[str] = mapped_column(String(4), default="")
    m11: Mapped[str] = mapped_column(String(4), default="")
    m12: Mapped[str] = mapped_column(String(4), default="")


# -- 10 / 11. LabTest / LabTestItem -- 検査 -------------------------------------

class LabTest(Base):
    __tablename__ = "lab_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    visit_id: Mapped[int | None] = mapped_column(ForeignKey("visits.id"), default=None)
    category: Mapped[str] = mapped_column(String(100), default="")
    tested_on: Mapped[dt.date] = mapped_column(Date)
    tested_at_time: Mapped[str] = mapped_column(String(10), default="")
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)

    items: Mapped[list["LabTestItem"]] = relationship(back_populates="lab_test")


class LabTestItem(Base):
    __tablename__ = "lab_test_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    lab_test_id: Mapped[int] = mapped_column(ForeignKey("lab_tests.id"))
    item_code: Mapped[str] = mapped_column(String(20))
    value_num: Mapped[float | None] = mapped_column(Numeric(10, 3), default=None)
    value_text: Mapped[str | None] = mapped_column(String(200), default=None)

    lab_test: Mapped["LabTest"] = relationship(back_populates="items")


# -- 12 / 13. Billing / BillingDetail -- 会計 -----------------------------------

class Billing(Base):
    __tablename__ = "billings"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"))
    slip_no: Mapped[str | None] = mapped_column(String(30), unique=True, default=None)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft / confirmed
    billed_on: Mapped[dt.date] = mapped_column(Date)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)
    cashier_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)
    paid_amount: Mapped[int | None] = mapped_column(Integer, default=None)
    payment_method: Mapped[str | None] = mapped_column(String(30), default=None)

    details: Mapped[list["BillingDetail"]] = relationship(
        back_populates="billing", order_by="BillingDetail.row_no"
    )


class BillingDetail(Base):
    __tablename__ = "billing_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    billing_id: Mapped[int] = mapped_column(ForeignKey("billings.id"))
    row_no: Mapped[int] = mapped_column(Integer)
    price_code: Mapped[str] = mapped_column(String(20), default="")
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1)
    # 未設定がありうる。ここが検算2の要点。NULL のまま持つこと（0で埋めない）。
    unit_price: Mapped[int | None] = mapped_column(Integer, default=None)
    is_taxable: Mapped[bool] = mapped_column(Boolean, default=True)

    billing: Mapped["Billing"] = relationship(back_populates="details")


# -- 14. Reservation -- 予約（新） -----------------------------------------------

class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    starts_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"))
    room: Mapped[str] = mapped_column(String(50))
    purpose: Mapped[str] = mapped_column(String(200), default="")
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="booked")  # booked / cancelled


# -- 15. Hospitalization / CareRecord -- 入院 -----------------------------------

class Hospitalization(Base):
    __tablename__ = "hospitalizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    admitted_on: Mapped[dt.date] = mapped_column(Date)
    discharged_on: Mapped[dt.date | None] = mapped_column(Date, default=None)
    room: Mapped[str] = mapped_column(String(50), default="")

    care_records: Mapped[list["CareRecord"]] = relationship(
        back_populates="hospitalization", order_by="CareRecord.recorded_at"
    )


class CareRecord(Base):
    """入院のケア記録。performed_by_staff_id は必須（検算7）。

    NOT NULL にしているのは「型で弾けるところは型で弾く」の実践。
    ただし「本当に実在する Staff か」はDBを引かないと分からないので、
    それは業務検証（ルーター側）の仕事にする。
    """

    __tablename__ = "care_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospitalization_id: Mapped[int] = mapped_column(ForeignKey("hospitalizations.id"))
    recorded_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    category: Mapped[str] = mapped_column(String(50))  # medication / feeding / measurement 等
    content: Mapped[str] = mapped_column(String(500), default="")
    performed_by_staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=False)

    hospitalization: Mapped["Hospitalization"] = relationship(back_populates="care_records")


# -- Paper -- 書類（screen 13）--------------------------------------------------
#
# `spec/model.md`「落としたもの」表に KartePdf（紙カルテの取込）が載っていたが、
# 裁定 R-21（`coordination/qa/lane-d.md` D-11 参照）で範囲内と確定した。ここでの
# Paper は「ファイルの取込」ではなく、動物に紐づく文書の**タイトルと備考だけを持つ台帳**
# （`openapi.yaml` Paper スキーマにファイル本体の項目が無いことに合わせた）。
#
# `removed_at`: `spec/screens.md` 13番「満たすべきこと」が
# 「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」と明記しているため、
# Owner/Patient/Visit と同じ論理削除にした（2026-09-06訂正。最初は契約にrestoreが
# 無いことを理由に物理削除にしていたが、「物理削除しない」はrestoreの有無と無関係の
# 別の要件だった——見落とし）。

class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    title: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(String(1000), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    removed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=None)
