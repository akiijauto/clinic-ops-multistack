"""受付・患者ドメイン。担当: サブエージェント「reception-patients」。

`spec/openapi.yaml` の以下を実装する場所（screens-reception / api-reception）:

- 画面: /animals/new, /animals/{karte_no}, /animals/{karte_no}/delete, /animals/{karte_no}/history
- API: /api/patients, /api/patients/{karte_no}, /api/patients/{karte_no}/delete,
  /api/patients/{karte_no}/restore, /api/owners/{owner_no}, /api/owners/{owner_no}/delete,
  /api/receptions, /api/patients/{karte_no}/receptions, /api/receptions/{id},
  /api/patients/{karte_no}/visits, /api/visits/{visit_id}, /api/visits/{visit_id}/delete,
  /api/visits/{visit_id}/restore

`Owner` / `Patient` / `Visit` は論理削除（`deleted_at`）。一覧・検索の既定は
`deleted_at IS NULL` で絞る（`include_deleted=true` で含める）。物理削除はしない。

`karte_no` / `owner_no` は表示用の文字列キー。実データ（`data/seed.json`）は
`karte_no` が `"10001"` のような単純な連番文字列で、`openapi.yaml` の
`KarteNo` パラメータが書く `^[0-9]+-[0-9]+$` パターンとは一致しない
（`coordination/qa/lane-d.md` D-12 に記録）。この実装は既存データ・既存の
他ルーター（`karte.py` 等）に合わせ、`karte_no` を書式チェックしない不透明な
文字列として扱う。新規発行も同じ書式（数字だけ）で連番にする。
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.billing_calc import DetailLike, calc_billing_totals
from app.config import JST
from app.db import get_db
from app.errors import ApiError

router = APIRouter()

SEX_VALUES = {"male", "female", "unknown"}
RECEPTION_STATUS_VALUES = {"waiting", "in_exam", "done"}


# ============================================================
# 補助関数
# ============================================================

def _patient_or_404(karte_no: str, db: Session) -> models.Patient:
    """`deleted_at` の有無を問わず探す（削除済みも顧客画面・APIの単体取得では見られる必要があるため）。"""
    patient = db.query(models.Patient).filter(models.Patient.karte_no == karte_no).first()
    if patient is None:
        raise ApiError("not_found")
    return patient


def _owner_or_404(owner_no: str, db: Session) -> models.Owner:
    owner = db.query(models.Owner).filter(models.Owner.owner_no == owner_no).first()
    if owner is None:
        raise ApiError("not_found")
    return owner


def _visit_or_404(visit_id: int, db: Session) -> models.Visit:
    visit = db.get(models.Visit, visit_id)
    if visit is None:
        raise ApiError("not_found")
    return visit


def _reception_or_404(reception_id: int, db: Session) -> models.Reception:
    reception = db.get(models.Reception, reception_id)
    if reception is None:
        raise ApiError("not_found")
    return reception


def _next_karte_no(db: Session) -> str:
    """既存データが `"10001"` のような数字だけの連番なので、その流儀に合わせる。"""
    rows = db.query(models.Patient.karte_no).all()
    nums = [int(k) for (k,) in rows if k.isdigit()]
    return str((max(nums) if nums else 10000) + 1)


def _next_owner_no(db: Session) -> str:
    rows = db.query(models.Owner.owner_no).all()
    nums = [int(o[2:]) for (o,) in rows if o.startswith("O-") and o[2:].isdigit()]
    return f"O-{(max(nums) if nums else 0) + 1:05d}"


def _parse_date(s: str | None) -> tuple[dt.date | None, bool]:
    """`(値, 失敗したか)`。空文字は「未入力」として `(None, False)` を返す。"""
    s = (s or "").strip()
    if not s:
        return None, False
    try:
        return dt.date.fromisoformat(s), False
    except ValueError:
        return None, True


def _billing_summary(patient: models.Patient, db: Session) -> list[dict]:
    """未収金・内金の要約（screens.md 3番）。確定済みで残額が0でない伝票だけ拾う。

    金額計算は `app/billing_calc.py` に一本化されたロジックを使う（独自に計算し直さない）。
    """
    clinic = db.query(models.Clinic).first()
    tax_rate = clinic.tax_rate if clinic is not None else Decimal("0.10")
    billings = db.query(models.Billing).filter(models.Billing.patient_id == patient.id).all()
    rows = []
    for b in billings:
        if b.status != "confirmed":
            continue
        details = [
            DetailLike(quantity=Decimal(str(d.quantity)), unit_price=d.unit_price, is_taxable=d.is_taxable)
            for d in b.details
        ]
        totals = calc_billing_totals(details, tax_rate)
        paid = b.paid_amount or 0
        balance = totals.total_amount - paid
        if balance != 0:
            rows.append({
                "slip_no": b.slip_no,
                "billed_on": b.billed_on,
                "total_amount": totals.total_amount,
                "paid_amount": paid,
                "balance": balance,
            })
    return rows


# ============================================================
# JSON API — Patient / Owner
# ============================================================

def _serialize_owner(o: models.Owner) -> dict:
    return {
        "id": o.id,
        "owner_no": o.owner_no,
        "name_kana": o.name_kana,
        "name_kanji": o.name_kanji,
        "postal_code": o.postal_code,
        "address1": o.address1,
        "address2": o.address2,
        "phone": o.phone,
        "mobile": o.mobile,
        "deleted_at": o.deleted_at.isoformat() if o.deleted_at else None,
    }


def _serialize_patient(p: models.Patient) -> dict:
    return {
        "id": p.id,
        "karte_no": p.karte_no,
        "owner_id": p.owner_id,
        "name_kana": p.name_kana,
        "name_kanji": p.name_kanji,
        "species": p.species,
        "breed": p.breed,
        "sex": p.sex,
        "birth_date": p.birth_date.isoformat() if p.birth_date else None,
        "neuter_date": p.neuter_date.isoformat() if p.neuter_date else None,
        "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
    }


def _serialize_patient_with_owner(p: models.Patient) -> dict:
    body = _serialize_patient(p)
    body["owner"] = _serialize_owner(p.owner) if p.owner is not None else None
    return body


class PatientIn(BaseModel):
    owner_id: int
    name_kana: str = ""
    name_kanji: str
    species: str
    breed: str | None = None
    sex: str
    birth_date: dt.date | None = None
    neuter_date: dt.date | None = None


class OwnerIn(BaseModel):
    name_kana: str = ""
    name_kanji: str
    postal_code: str | None = None
    address1: str | None = None
    address2: str | None = None
    phone: str | None = None
    mobile: str | None = None


@router.get("/api/patients")
def api_list_patients(
    q: str | None = None,
    include_deleted: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(models.Patient)
    if not include_deleted:
        query = query.filter(models.Patient.deleted_at.is_(None))
    if q:
        like = f"%{q}%"
        query = query.join(models.Owner, models.Patient.owner_id == models.Owner.id).filter(
            models.Patient.name_kanji.like(like)
            | models.Patient.name_kana.like(like)
            | models.Patient.karte_no.like(like)
            | models.Owner.phone.like(like)
            | models.Owner.mobile.like(like)
        )
    total = query.count()
    rows = query.order_by(models.Patient.karte_no).offset(offset).limit(limit).all()
    return {"items": [_serialize_patient_with_owner(p) for p in rows], "total": total}


@router.get("/api/patients/{karte_no}")
def api_get_patient(karte_no: str, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    return _serialize_patient_with_owner(patient)


@router.patch("/api/patients/{karte_no}")
def api_update_patient(karte_no: str, body: PatientIn, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    if body.sex not in SEX_VALUES:
        raise ApiError("invalid_input", [{"field": "sex", "message": "male/female/unknown のいずれかにしてください。"}])
    owner = db.get(models.Owner, body.owner_id)
    if owner is None:
        raise ApiError("invalid_input", [{"field": "owner_id", "message": "指定した飼主が見つかりません。"}])
    patient.owner_id = body.owner_id
    patient.name_kana = body.name_kana
    patient.name_kanji = body.name_kanji
    patient.species = body.species
    patient.breed = body.breed or ""
    patient.sex = body.sex
    patient.birth_date = body.birth_date
    patient.neuter_date = body.neuter_date
    db.commit()
    db.refresh(patient)
    return _serialize_patient(patient)


@router.post("/api/patients/{karte_no}/delete")
def api_delete_patient(karte_no: str, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    now = dt.datetime.now(JST)
    if patient.deleted_at is None:
        patient.deleted_at = now
        owner = patient.owner
        if owner is not None and owner.deleted_at is None:
            remaining = (
                db.query(models.Patient)
                .filter(models.Patient.owner_id == owner.id, models.Patient.deleted_at.is_(None))
                .count()
            )
            if remaining == 0:
                owner.deleted_at = now
        db.commit()
        db.refresh(patient)
    return _serialize_patient(patient)


@router.post("/api/patients/{karte_no}/restore")
def api_restore_patient(karte_no: str, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    patient.deleted_at = None
    db.commit()
    db.refresh(patient)
    return _serialize_patient(patient)


@router.get("/api/owners/{owner_no}")
def api_get_owner(owner_no: str, db: Session = Depends(get_db)):
    return _serialize_owner(_owner_or_404(owner_no, db))


@router.patch("/api/owners/{owner_no}")
def api_update_owner(owner_no: str, body: OwnerIn, db: Session = Depends(get_db)):
    owner = _owner_or_404(owner_no, db)
    owner.name_kana = body.name_kana
    owner.name_kanji = body.name_kanji
    owner.postal_code = body.postal_code or ""
    owner.address1 = body.address1 or ""
    owner.address2 = body.address2 or ""
    owner.phone = body.phone or ""
    owner.mobile = body.mobile or ""
    db.commit()
    db.refresh(owner)
    return _serialize_owner(owner)


@router.post("/api/owners/{owner_no}/delete")
def api_delete_owner(owner_no: str, db: Session = Depends(get_db)):
    owner = _owner_or_404(owner_no, db)
    if owner.deleted_at is None:
        owner.deleted_at = dt.datetime.now(JST)
        db.commit()
        db.refresh(owner)
    return _serialize_owner(owner)


# ============================================================
# JSON API — Reception（本日の患者）
# ============================================================

def _serialize_reception(r: models.Reception) -> dict:
    return {
        "id": r.id,
        "patient_id": r.patient_id,
        "display_no": r.display_no,
        "received_at": r.received_at.isoformat(),
        "owner_purpose": r.owner_purpose,
        "medical_purpose": r.medical_purpose,
        "status": r.status,
        "staff_id": r.staff_id,
    }


class ReceptionIn(BaseModel):
    patient_id: int | None = None
    display_no: int | None = None
    received_at: dt.datetime | None = None
    owner_purpose: str | None = None
    medical_purpose: str | None = None
    status: str = "waiting"
    staff_id: int | None = None


def _create_reception(patient_id: int, body: ReceptionIn, db: Session) -> models.Reception:
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id, models.Patient.deleted_at.is_(None)
    ).first()
    if patient is None:
        raise ApiError("not_found")
    if body.status not in RECEPTION_STATUS_VALUES:
        raise ApiError("invalid_input", [{"field": "status", "message": "waiting/in_exam/done のいずれかにしてください。"}])
    received_at = body.received_at or dt.datetime.now(JST)
    if body.display_no is not None:
        display_no = body.display_no
    else:
        day_start = dt.datetime.combine(received_at.date(), dt.time.min, tzinfo=JST)
        day_end = day_start + dt.timedelta(days=1)
        max_no = (
            db.query(func.max(models.Reception.display_no))
            .filter(models.Reception.received_at >= day_start, models.Reception.received_at < day_end)
            .scalar()
        )
        display_no = (max_no or 0) + 1
    reception = models.Reception(
        patient_id=patient_id,
        display_no=display_no,
        received_at=received_at,
        owner_purpose=body.owner_purpose or "",
        medical_purpose=body.medical_purpose or "",
        status=body.status,
        staff_id=body.staff_id,
    )
    db.add(reception)
    db.commit()
    db.refresh(reception)
    return reception


@router.get("/api/receptions")
def api_list_receptions(
    kind: str | None = None,
    date: dt.date | None = None,
    db: Session = Depends(get_db),
):
    day = date or dt.datetime.now(JST).date()
    day_start = dt.datetime.combine(day, dt.time.min, tzinfo=JST)
    day_end = day_start + dt.timedelta(days=1)
    query = db.query(models.Reception).filter(
        models.Reception.received_at >= day_start, models.Reception.received_at < day_end
    )
    if kind:
        # 契約上 `kind` の元は `data/masters.json` の `reception_kinds`。
        # Reception には独立した「種別」列が無いため、目的欄への一致で代用する
        # （`coordination/qa/lane-d.md` D-12 に記録）。
        query = query.filter(
            (models.Reception.owner_purpose == kind) | (models.Reception.medical_purpose == kind)
        )
    rows = query.order_by(models.Reception.display_no).all()
    return {"items": [_serialize_reception(r) for r in rows], "total": len(rows)}


@router.post("/api/receptions", status_code=201)
def api_create_reception(body: ReceptionIn, db: Session = Depends(get_db)):
    if body.patient_id is None:
        raise ApiError("invalid_input", [{"field": "patient_id", "message": "patient_id は必須です。"}])
    reception = _create_reception(body.patient_id, body, db)
    return _serialize_reception(reception)


@router.post("/api/patients/{karte_no}/receptions", status_code=201)
def api_create_patient_reception(karte_no: str, body: ReceptionIn, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    reception = _create_reception(patient.id, body, db)
    return _serialize_reception(reception)


@router.get("/api/receptions/{id}")
def api_get_reception(id: int, db: Session = Depends(get_db)):
    return _serialize_reception(_reception_or_404(id, db))


@router.patch("/api/receptions/{id}")
def api_update_reception(id: int, body: ReceptionIn, db: Session = Depends(get_db)):
    reception = _reception_or_404(id, db)
    if body.status not in RECEPTION_STATUS_VALUES:
        raise ApiError("invalid_input", [{"field": "status", "message": "waiting/in_exam/done のいずれかにしてください。"}])
    if body.patient_id is not None:
        reception.patient_id = body.patient_id
    if body.display_no is not None:
        reception.display_no = body.display_no
    if body.received_at is not None:
        reception.received_at = body.received_at
    if body.owner_purpose is not None:
        reception.owner_purpose = body.owner_purpose
    if body.medical_purpose is not None:
        reception.medical_purpose = body.medical_purpose
    reception.status = body.status
    if body.staff_id is not None:
        reception.staff_id = body.staff_id
    db.commit()
    db.refresh(reception)
    return _serialize_reception(reception)


# ============================================================
# JSON API — Visit（診察・来院履歴の元データ）
# ============================================================

def _serialize_progress_note(n: models.ProgressNote) -> dict:
    return {
        "id": n.id,
        "visit_id": n.visit_id,
        "row_no": n.row_no,
        "entry_date": n.entry_date.isoformat(),
        "temperature_c": float(n.temperature_c) if n.temperature_c is not None else None,
        "pulse": n.pulse,
        "respiration": n.respiration,
        "body_weight_kg": float(n.body_weight_kg) if n.body_weight_kg is not None else None,
        "symptom_course": n.symptom_course,
        "treatment_rx": n.treatment_rx,
        "note": n.note,
    }


def _serialize_visit(v: models.Visit) -> dict:
    return {
        "id": v.id,
        "patient_id": v.patient_id,
        "visit_no": v.visit_no,
        "visit_date": v.visit_date.isoformat(),
        "visit_time": v.visit_time or None,
        "body_weight_kg": float(v.body_weight_kg) if v.body_weight_kg is not None else None,
        "chief_complaint": v.chief_complaint,
        "symptom": v.symptom,
        "diagnosis": v.diagnosis,
        "treatment": v.treatment,
        "staff_id": v.staff_id,
        "deleted_at": v.deleted_at.isoformat() if v.deleted_at else None,
        "progress_notes": [_serialize_progress_note(n) for n in v.progress_notes],
    }


class ProgressNoteIn(BaseModel):
    row_no: int
    entry_date: dt.date
    temperature_c: float | None = None
    pulse: int | None = None
    respiration: int | None = None
    body_weight_kg: float | None = None
    symptom_course: str | None = None
    treatment_rx: str | None = None
    note: str | None = None


class VisitIn(BaseModel):
    visit_date: dt.date
    visit_time: str | None = None
    body_weight_kg: float | None = None
    chief_complaint: str | None = None
    symptom: str | None = None
    diagnosis: str | None = None
    treatment: str | None = None
    staff_id: int | None = None
    progress_notes: list[ProgressNoteIn] = []


def _apply_progress_notes(visit: models.Visit, notes: list[ProgressNoteIn], db: Session) -> None:
    db.query(models.ProgressNote).filter(models.ProgressNote.visit_id == visit.id).delete()
    db.flush()
    for n in notes:
        db.add(models.ProgressNote(
            visit_id=visit.id,
            row_no=n.row_no,
            entry_date=n.entry_date,
            temperature_c=n.temperature_c,
            pulse=n.pulse,
            respiration=n.respiration,
            body_weight_kg=n.body_weight_kg,
            symptom_course=n.symptom_course or "",
            treatment_rx=n.treatment_rx or "",
            note=n.note or "",
        ))


@router.get("/api/patients/{karte_no}/visits")
def api_list_visits(
    karte_no: str,
    include_deleted: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    query = db.query(models.Visit).filter(models.Visit.patient_id == patient.id)
    if not include_deleted:
        query = query.filter(models.Visit.deleted_at.is_(None))
    total = query.count()
    rows = (
        query.order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc())
        .offset(offset).limit(limit).all()
    )
    return {"items": [_serialize_visit(v) for v in rows], "total": total}


@router.post("/api/patients/{karte_no}/visits", status_code=201)
def api_create_visit(karte_no: str, body: VisitIn, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    existing = db.query(models.Visit).filter(models.Visit.patient_id == patient.id).all()
    next_no = (max((v.visit_no for v in existing), default=0)) + 1
    visit = models.Visit(
        patient_id=patient.id,
        visit_no=next_no,
        visit_date=body.visit_date,
        visit_time=body.visit_time or "",
        body_weight_kg=body.body_weight_kg,
        chief_complaint=body.chief_complaint or "",
        symptom=body.symptom or "",
        diagnosis=body.diagnosis or "",
        treatment=body.treatment or "",
        staff_id=body.staff_id,
    )
    db.add(visit)
    db.flush()
    _apply_progress_notes(visit, body.progress_notes, db)
    db.commit()
    db.refresh(visit)
    return _serialize_visit(visit)


@router.get("/api/visits/{visit_id}")
def api_get_visit(visit_id: int, db: Session = Depends(get_db)):
    return _serialize_visit(_visit_or_404(visit_id, db))


@router.patch("/api/visits/{visit_id}")
def api_update_visit(visit_id: int, body: VisitIn, db: Session = Depends(get_db)):
    visit = _visit_or_404(visit_id, db)
    visit.visit_date = body.visit_date
    visit.visit_time = body.visit_time or ""
    visit.body_weight_kg = body.body_weight_kg
    visit.chief_complaint = body.chief_complaint or ""
    visit.symptom = body.symptom or ""
    visit.diagnosis = body.diagnosis or ""
    visit.treatment = body.treatment or ""
    visit.staff_id = body.staff_id
    _apply_progress_notes(visit, body.progress_notes, db)
    db.commit()
    db.refresh(visit)
    return _serialize_visit(visit)


@router.post("/api/visits/{visit_id}/delete")
def api_delete_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = _visit_or_404(visit_id, db)
    if visit.deleted_at is None:
        visit.deleted_at = dt.datetime.now(JST)
        db.commit()
        db.refresh(visit)
    return _serialize_visit(visit)


@router.post("/api/visits/{visit_id}/restore")
def api_restore_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = _visit_or_404(visit_id, db)
    visit.deleted_at = None
    db.commit()
    db.refresh(visit)
    return _serialize_visit(visit)


# ============================================================
# 画面 — 新規登録 /animals/new
# ============================================================

def _new_animal_context(db: Session, existing_owner: models.Owner | None, form: dict, banner) -> dict:
    return {
        "owner": existing_owner,
        "next_karte_no": _next_karte_no(db),
        "form": form,
        "banner": banner,
    }


@router.get("/animals/new", response_class=HTMLResponse)
def screen_new_animal_form(request: Request, owner: str | None = None, db: Session = Depends(get_db)):
    existing_owner = None
    if owner:
        existing_owner = _owner_or_404(owner, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "reception/animal_new.html",
        _new_animal_context(db, existing_owner, {}, None),
    )


@router.post("/animals/new", response_class=HTMLResponse)
def screen_create_animal(
    request: Request,
    owner: str | None = None,
    owner_name_kanji: str = Form(""),
    owner_name_kana: str = Form(""),
    owner_postal_code: str = Form(""),
    owner_address1: str = Form(""),
    owner_address2: str = Form(""),
    owner_phone: str = Form(""),
    owner_mobile: str = Form(""),
    name_kanji: str = Form(""),
    name_kana: str = Form(""),
    species: str = Form(""),
    breed: str = Form(""),
    sex: str = Form("unknown"),
    birth_date: str = Form(""),
    neuter_date: str = Form(""),
    db: Session = Depends(get_db),
):
    templates = request.app.state.templates
    existing_owner = None
    if owner:
        existing_owner = _owner_or_404(owner, db)

    form = {
        "owner_name_kanji": owner_name_kanji, "owner_name_kana": owner_name_kana,
        "owner_postal_code": owner_postal_code, "owner_address1": owner_address1,
        "owner_address2": owner_address2, "owner_phone": owner_phone, "owner_mobile": owner_mobile,
        "name_kanji": name_kanji, "name_kana": name_kana, "species": species, "breed": breed,
        "sex": sex, "birth_date": birth_date, "neuter_date": neuter_date,
    }

    def fail(message: str) -> HTMLResponse:
        return templates.TemplateResponse(
            request, "reception/animal_new.html",
            _new_animal_context(db, existing_owner, form, ("error", message)),
        )

    if not name_kanji.strip():
        return fail("動物の氏名を入力してください。")
    if not species.strip():
        return fail("動物種を入力してください。")
    if sex not in SEX_VALUES:
        return fail("性別は male / female / unknown のいずれかにしてください。")
    if existing_owner is None and not owner_name_kanji.strip():
        return fail("飼主の氏名を入力してください。")

    birth, birth_bad = _parse_date(birth_date)
    if birth_bad:
        return fail("生年月日の形式が正しくありません（例: 2020-01-31）。")
    neuter, neuter_bad = _parse_date(neuter_date)
    if neuter_bad:
        return fail("不妊・去勢日の形式が正しくありません（例: 2020-01-31）。")

    if existing_owner is not None:
        owner_row = existing_owner
    else:
        owner_row = models.Owner(
            owner_no=_next_owner_no(db),
            name_kana=owner_name_kana, name_kanji=owner_name_kanji,
            postal_code=owner_postal_code, address1=owner_address1, address2=owner_address2,
            phone=owner_phone, mobile=owner_mobile,
        )
        db.add(owner_row)
        db.flush()

    patient_row = models.Patient(
        karte_no=_next_karte_no(db), owner_id=owner_row.id,
        name_kana=name_kana, name_kanji=name_kanji, species=species, breed=breed,
        sex=sex, birth_date=birth, neuter_date=neuter,
    )
    db.add(patient_row)
    db.commit()
    db.refresh(patient_row)

    return templates.TemplateResponse(
        request, "reception/animal_new.html",
        _new_animal_context(
            db, existing_owner, {},
            ("success", f"登録しました（カルテNo: {patient_row.karte_no}）。この画面から離れずに続けて登録できます。"),
        ) | {"created_karte_no": patient_row.karte_no},
    )


# ============================================================
# 画面 — 顧客 /animals/{karte_no}
# ============================================================

@router.get("/animals/{karte_no}", response_class=HTMLResponse)
def screen_animal_detail(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "reception/animal_detail.html",
        {"patient": patient, "owner": patient.owner, "billing_rows": _billing_summary(patient, db), "banner": None},
    )


@router.post("/animals/{karte_no}", response_class=HTMLResponse)
def screen_animal_detail_save(
    karte_no: str,
    request: Request,
    action: str = Form("save"),
    owner_name_kanji: str = Form(""),
    owner_name_kana: str = Form(""),
    owner_postal_code: str = Form(""),
    owner_address1: str = Form(""),
    owner_address2: str = Form(""),
    owner_phone: str = Form(""),
    owner_mobile: str = Form(""),
    name_kanji: str = Form(""),
    name_kana: str = Form(""),
    species: str = Form(""),
    breed: str = Form(""),
    sex: str = Form(""),
    birth_date: str = Form(""),
    neuter_date: str = Form(""),
    new_karte_no: str = Form(""),
    new_owner_no: str = Form(""),
    db: Session = Depends(get_db),
):
    """`spec/openapi.yaml` は `/animals/{karte_no}` に GET しか定義していないが、
    `spec/screens.md` 3番はこの画面に「保存」「番号変更」を求めている。
    `/settings` が同じ画面パスへ GET/POST を両方定義している前例に倣い、
    この画面固有の保存フォームを追加した（`coordination/qa/lane-d.md` D-12）。
    """
    patient = _patient_or_404(karte_no, db)
    owner = patient.owner
    templates = request.app.state.templates

    def render(banner) -> HTMLResponse:
        return templates.TemplateResponse(
            request, "reception/animal_detail.html",
            {"patient": patient, "owner": owner, "billing_rows": _billing_summary(patient, db), "banner": banner},
        )

    if action == "renumber_patient":
        target = new_karte_no.strip()
        if not target:
            return render(("error", "新しいカルテNoを入力してください。"))
        conflict = db.query(models.Patient).filter(models.Patient.karte_no == target).first()
        if conflict is not None and conflict.id != patient.id:
            return render(("error", "そのカルテNoは既に使われています。"))
        patient.karte_no = target
        db.commit()
        db.refresh(patient)
        return render(("success", f"カルテNoを {patient.karte_no} に変更しました。"))

    if action == "renumber_owner":
        if owner is None:
            return render(("error", "飼主が見つかりません。"))
        target = new_owner_no.strip()
        if not target:
            return render(("error", "新しい飼主番号を入力してください。"))
        conflict = db.query(models.Owner).filter(models.Owner.owner_no == target).first()
        if conflict is not None and conflict.id != owner.id:
            return render(("error", "その飼主番号は既に使われています。"))
        owner.owner_no = target
        db.commit()
        db.refresh(owner)
        return render(("success", f"飼主番号を {owner.owner_no} に変更しました。"))

    # action == "save"（既定）: Owner・Patient の項目を更新する。
    if not name_kanji.strip():
        return render(("error", "動物の氏名を入力してください。"))
    if not species.strip():
        return render(("error", "動物種を入力してください。"))
    if sex not in SEX_VALUES:
        return render(("error", "性別は male / female / unknown のいずれかにしてください。"))

    birth, birth_bad = _parse_date(birth_date)
    if birth_bad:
        return render(("error", "生年月日の形式が正しくありません（例: 2020-01-31）。"))
    neuter, neuter_bad = _parse_date(neuter_date)
    if neuter_bad:
        return render(("error", "不妊・去勢日の形式が正しくありません（例: 2020-01-31）。"))

    if owner is not None:
        owner.name_kanji = owner_name_kanji or owner.name_kanji
        owner.name_kana = owner_name_kana
        owner.postal_code = owner_postal_code
        owner.address1 = owner_address1
        owner.address2 = owner_address2
        owner.phone = owner_phone
        owner.mobile = owner_mobile

    patient.name_kanji = name_kanji
    patient.name_kana = name_kana
    patient.species = species
    patient.breed = breed
    patient.sex = sex
    patient.birth_date = birth
    patient.neuter_date = neuter
    db.commit()
    db.refresh(patient)

    return render(("success", "保存しました。"))


# ============================================================
# 画面 — 削除 /animals/{karte_no}/delete
# ============================================================

@router.get("/animals/{karte_no}/delete", response_class=HTMLResponse)
def screen_delete_animal_confirm(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "reception/animal_delete_confirm.html",
        {"patient": patient, "owner": patient.owner, "banner": None},
    )


@router.post("/animals/{karte_no}/delete", response_class=HTMLResponse)
def screen_delete_animal(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    templates = request.app.state.templates

    if patient.deleted_at is not None:
        return templates.TemplateResponse(
            request, "reception/animal_delete_confirm.html",
            {"patient": patient, "owner": patient.owner, "banner": ("error", "既に削除済みです。")},
        )

    now = dt.datetime.now(JST)
    patient.deleted_at = now
    owner = patient.owner
    if owner is not None and owner.deleted_at is None:
        remaining = (
            db.query(models.Patient)
            .filter(models.Patient.owner_id == owner.id, models.Patient.deleted_at.is_(None))
            .count()
        )
        if remaining == 0:
            owner.deleted_at = now
    db.commit()
    db.refresh(patient)

    return templates.TemplateResponse(
        request, "reception/animal_delete_confirm.html",
        {"patient": patient, "owner": patient.owner, "banner": ("success", "削除しました。")},
    )


# ============================================================
# 画面 — 来院履歴 /animals/{karte_no}/history
# ============================================================

@router.get("/animals/{karte_no}/history", response_class=HTMLResponse)
def screen_animal_history(karte_no: str, request: Request, db: Session = Depends(get_db)):
    """`AuditLog` は `model.md`「落としたもの」で意図して外されている
    （`app/feature_notes.py` の `audit_log` キー）ため、登録・修正の項目別
    前後値までは出せない。ここでは `Visit` の一覧（削除済みを含む）を新しい順に
    出し、削除済みの行に「元に戻す」への導線を付けることで、screens.md 5番の
    満たすべきことのうち手当てできる範囲を満たす（`coordination/qa/lane-d.md` D-12）。
    「元に戻す」自体の実行は `screens-clinical` 側のルート
    （`/animals/{karte_no}/karte/{visit_id}/restore`）に委ねる。
    """
    patient = _patient_or_404(karte_no, db)
    visits = (
        db.query(models.Visit)
        .filter(models.Visit.patient_id == patient.id)
        .order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc())
        .all()
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "reception/animal_history.html",
        {"patient": patient, "visits": visits},
    )
