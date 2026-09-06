"""`data/seed.json` をDBへ投入する。起動時に1回、**空のときだけ**行う。

べき等にしてある理由: 開発中にプロセスを何度も再起動するので、毎回二重に
投入されると検算（件数の一致）が崩れる。`Clinic` が既に1件あれば「投入済み」とみなす。
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import Session

from app import fixtures, models


def _parse_dt(value: str | None) -> dt.datetime | None:
    if value is None:
        return None
    return dt.datetime.fromisoformat(value)


def _parse_date(value: str | None) -> dt.date | None:
    if value is None:
        return None
    return dt.date.fromisoformat(value)


def is_seeded(session: Session) -> bool:
    return session.query(models.Clinic).first() is not None


def load_seed(session: Session) -> None:
    """`data/seed.json` の内容をそのままDBへ入れる。

    IDは `seed.json` に書かれた整数IDをそのまま使う（相互参照がIDベースのため、
    採番し直すと突き合わせが崩れる）。SQLiteはPKの明示指定を許すので問題ない。
    """
    if is_seeded(session):
        return

    seed = fixtures.seed()

    c = seed["clinic"]
    clinic = models.Clinic(
        id=c["id"],
        name=c["name"],
        postal_code=c.get("postal_code", ""),
        address1=c.get("address1", ""),
        address2=c.get("address2", ""),
        phone=c.get("phone", ""),
        fax=c.get("fax", ""),
        director_name=c.get("director_name", ""),
        reservation_slot_minutes=c.get("reservation_slot_minutes", 15),
        tax_rate=c.get("tax_rate", 0.10),
    )
    clinic.closed_weekdays = c.get("closed_weekdays", [])
    session.add(clinic)
    session.flush()  # SQLiteのFK即時検査に備え、依存先を先に確定させる

    for s in seed["staff"]:
        session.add(models.Staff(
            id=s["id"], staff_code=s["staff_code"], name=s["name"], role=s["role"],
            is_active=s["is_active"], password_hash=s.get("password_hash", ""),
        ))
    session.flush()

    for o in seed["owners"]:
        session.add(models.Owner(
            id=o["id"], owner_no=o["owner_no"], name_kana=o.get("name_kana", ""),
            name_kanji=o["name_kanji"], postal_code=o.get("postal_code", ""),
            address1=o.get("address1", ""), address2=o.get("address2", ""),
            phone=o.get("phone", ""), mobile=o.get("mobile", ""),
            deleted_at=_parse_dt(o.get("deleted_at")),
        ))
    session.flush()

    for p in seed["patients"]:
        session.add(models.Patient(
            id=p["id"], karte_no=p["karte_no"], owner_id=p["owner_id"],
            name_kana=p.get("name_kana", ""), name_kanji=p["name_kanji"],
            species=p["species"], breed=p.get("breed", ""), sex=p["sex"],
            birth_date=_parse_date(p.get("birth_date")),
            neuter_date=_parse_date(p.get("neuter_date")),
            deleted_at=_parse_dt(p.get("deleted_at")),
        ))
    session.flush()

    for r in seed["receptions"]:
        session.add(models.Reception(
            id=r["id"], patient_id=r["patient_id"], display_no=r["display_no"],
            received_at=_parse_dt(r["received_at"]), owner_purpose=r.get("owner_purpose", ""),
            medical_purpose=r.get("medical_purpose", ""), status=r.get("status", "waiting"),
            staff_id=r.get("staff_id"),
        ))
    session.flush()

    for v in seed["visits"]:
        session.add(models.Visit(
            id=v["id"], patient_id=v["patient_id"], visit_no=v["visit_no"],
            visit_date=_parse_date(v["visit_date"]), visit_time=v.get("visit_time", ""),
            body_weight_kg=v.get("body_weight_kg"), chief_complaint=v.get("chief_complaint", ""),
            symptom=v.get("symptom", ""), diagnosis=v.get("diagnosis", ""),
            treatment=v.get("treatment", ""), staff_id=v.get("staff_id"),
            deleted_at=_parse_dt(v.get("deleted_at")),
        ))
    session.flush()

    for n in seed["progress_notes"]:
        session.add(models.ProgressNote(
            id=n["id"], visit_id=n["visit_id"], row_no=n["row_no"],
            entry_date=_parse_date(n["entry_date"]), temperature_c=n.get("temperature_c"),
            pulse=n.get("pulse"), respiration=n.get("respiration"),
            body_weight_kg=n.get("body_weight_kg"), symptom_course=n.get("symptom_course", ""),
            treatment_rx=n.get("treatment_rx", ""), note=n.get("note", ""),
        ))
    session.flush()

    for pr in seed["preventions"]:
        session.add(models.Prevention(
            id=pr["id"], patient_id=pr["patient_id"], kind=pr["kind"],
            content=pr.get("content", ""), performed_date=_parse_date(pr["performed_date"]),
            next_due_date=_parse_date(pr.get("next_due_date")), staff_id=pr.get("staff_id"),
        ))
    session.flush()

    for d in seed["dosings"]:
        session.add(models.Dosing(
            id=d["id"], patient_id=d["patient_id"], kind=d["kind"],
            fiscal_year=d["fiscal_year"],
            m01=d.get("m01", ""), m02=d.get("m02", ""), m03=d.get("m03", ""),
            m04=d.get("m04", ""), m05=d.get("m05", ""), m06=d.get("m06", ""),
            m07=d.get("m07", ""), m08=d.get("m08", ""), m09=d.get("m09", ""),
            m10=d.get("m10", ""), m11=d.get("m11", ""), m12=d.get("m12", ""),
        ))
    session.flush()

    for lt in seed["lab_tests"]:
        session.add(models.LabTest(
            id=lt["id"], patient_id=lt["patient_id"], visit_id=lt.get("visit_id"),
            category=lt.get("category", ""), tested_on=_parse_date(lt["tested_on"]),
            tested_at_time=lt.get("tested_at_time", ""), staff_id=lt.get("staff_id"),
        ))
    session.flush()

    for li in seed["lab_test_items"]:
        session.add(models.LabTestItem(
            id=li["id"], lab_test_id=li["lab_test_id"], item_code=li["item_code"],
            value_num=li.get("value_num"), value_text=li.get("value_text"),
        ))
    session.flush()

    for b in seed["billings"]:
        session.add(models.Billing(
            id=b["id"], patient_id=b["patient_id"], owner_id=b["owner_id"],
            slip_no=b.get("slip_no"), status=b.get("status", "draft"),
            billed_on=_parse_date(b["billed_on"]), staff_id=b.get("staff_id"),
            cashier_staff_id=b.get("cashier_staff_id"), paid_amount=b.get("paid_amount"),
            payment_method=b.get("payment_method"),
        ))
    session.flush()

    for bd in seed["billing_details"]:
        session.add(models.BillingDetail(
            id=bd["id"], billing_id=bd["billing_id"], row_no=bd["row_no"],
            price_code=bd.get("price_code", ""), name=bd["name"], quantity=bd.get("quantity", 1),
            unit_price=bd.get("unit_price"), is_taxable=bd.get("is_taxable", True),
        ))
    session.flush()

    for rs in seed["reservations"]:
        session.add(models.Reservation(
            id=rs["id"], patient_id=rs["patient_id"], starts_at=_parse_dt(rs["starts_at"]),
            ends_at=_parse_dt(rs["ends_at"]), staff_id=rs["staff_id"], room=rs["room"],
            purpose=rs.get("purpose", ""), note=rs.get("note", ""),
            status=rs.get("status", "booked"),
        ))
    session.flush()

    for h in seed["hospitalizations"]:
        hosp = models.Hospitalization(
            id=h["id"], patient_id=h["patient_id"], admitted_on=_parse_date(h["admitted_on"]),
            discharged_on=_parse_date(h.get("discharged_on")), room=h.get("room", ""),
        )
        session.add(hosp)
        for cr in h.get("care_records", []):
            # 注意: seed.json の care_records[].id は入院ごとに 1 から振り直されており、
            # 全体では一意でない（2026-09-05 実測）。他のテーブルからこのIDを参照する
            # ものは無いので、そのまま使わずDBに採番させる。
            session.add(models.CareRecord(
                hospitalization_id=h["id"], recorded_at=_parse_dt(cr["recorded_at"]),
                category=cr.get("category", ""), content=cr.get("content", ""),
                performed_by_staff_id=cr["performed_by_staff_id"],
            ))
    session.flush()

    # visit_id は models.Paper に列が無く保持できない（openapi.yaml の Paper
    # スキーマにも無い）。taken_on（取込日）を created_at として使う。
    for p in seed.get("papers", []):
        session.add(models.Paper(
            id=p["id"], patient_id=p["patient_id"], title=p["title"],
            note=p.get("note"), created_at=_parse_dt(p["taken_on"] + "T00:00:00+09:00"),
            removed_at=_parse_dt(p.get("removed_at")),
        ))
    session.flush()

    session.commit()
