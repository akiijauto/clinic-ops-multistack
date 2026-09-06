"""入院API + 画面。`spec/acceptance.md` 検算7・`spec/screens.md` 18「入院」。

**実施者（`performed_by_staff_id`）は必須。** 無い記録行は作らせない（422）。
退院済み（`discharged_on` あり）の入院には新しいケア記録を追加できない
（`spec/screens.md` 18「満たすべきこと」）。

担当: サブエージェント「ward-reservations」が
`/animals/{karte_no}/ward` `/ward/day` `/api/ward` `/api/patients/{karte_no}/hospitalizations`
を追記した（`coordination/qa/lane-d.md` D-12 以降参照）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.config import JST
from app.db import get_db
from app.errors import ApiError

router = APIRouter(tags=["api-ward"])


class CareRecordCreate(BaseModel):
    recorded_at: dt.datetime
    category: str
    content: str | None = None
    performed_by_staff_id: int | None = None


class HospitalizationCreate(BaseModel):
    admitted_on: dt.date
    discharged_on: dt.date | None = None
    room: str


def _today_jst() -> dt.date:
    return dt.datetime.now(JST).date()


def _patient_or_404(karte_no: str, db: Session) -> models.Patient:
    p = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if p is None:
        raise ApiError("not_found")
    return p


def _hospitalization_dict(h: models.Hospitalization) -> dict:
    return {
        "id": h.id,
        "patient_id": h.patient_id,
        "admitted_on": h.admitted_on.isoformat(),
        "discharged_on": h.discharged_on.isoformat() if h.discharged_on else None,
        "room": h.room,
        "care_records": [_care_record_dict(r) for r in h.care_records],
    }


def _care_record_dict(r: models.CareRecord) -> dict:
    return {
        "id": r.id,
        "hospitalization_id": r.hospitalization_id,
        "recorded_at": r.recorded_at.isoformat(),
        "category": r.category,
        "content": r.content,
        "performed_by_staff_id": r.performed_by_staff_id,
    }


def _hosp_or_404(hospitalization_id: int, db: Session) -> models.Hospitalization:
    h = db.get(models.Hospitalization, hospitalization_id)
    if h is None:
        raise ApiError("not_found")
    return h


@router.get("/api/hospitalizations/{hospitalization_id}")
def get_hospitalization(hospitalization_id: int, db: Session = Depends(get_db)):
    h = _hosp_or_404(hospitalization_id, db)
    return {
        "id": h.id,
        "patient_id": h.patient_id,
        "admitted_on": h.admitted_on.isoformat(),
        "discharged_on": h.discharged_on.isoformat() if h.discharged_on else None,
        "room": h.room,
        "care_records": [_care_record_dict(r) for r in h.care_records],
    }


@router.get("/api/hospitalizations/{hospitalization_id}/care-records")
def list_care_records(hospitalization_id: int, db: Session = Depends(get_db)):
    h = _hosp_or_404(hospitalization_id, db)
    rows = h.care_records
    return {"items": [_care_record_dict(r) for r in rows], "total": len(rows)}


@router.post("/api/hospitalizations/{hospitalization_id}/care-records", status_code=201)
def create_care_record(
    hospitalization_id: int, body: CareRecordCreate, db: Session = Depends(get_db),
):
    h = _hosp_or_404(hospitalization_id, db)
    # 実施者は必須（model.md 15章・acceptance.md 検算7）。空の記録行は作らない。
    if not body.performed_by_staff_id:
        raise ApiError(
            "invalid_input",
            [{"field": "performed_by_staff_id", "message": "実施者は必須です。"}],
        )
    if h.discharged_on is not None:
        raise ApiError(
            "invalid_input",
            [{"field": "hospitalization_id", "message": "退院済みの入院には記録を追加できません。"}],
        )
    r = models.CareRecord(
        hospitalization_id=h.id, recorded_at=body.recorded_at, category=body.category,
        content=body.content or "", performed_by_staff_id=body.performed_by_staff_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _care_record_dict(r)


@router.get("/api/ward")
def api_ward_day(date: dt.date | None = None, db: Session = Depends(get_db)):
    """指定日（省略時はJST本日）に在院中の入院一覧。

    仮決め（D-12）: 契約に絞り込み条件の詳細が薄いため、`admitted_on <= date` かつ
    （`discharged_on` が無い、または `discharged_on >= date`）を「在院中」とした。
    """
    target = date or _today_jst()
    rows = (
        db.query(models.Hospitalization)
        .filter(
            models.Hospitalization.admitted_on <= target,
            (models.Hospitalization.discharged_on.is_(None))
            | (models.Hospitalization.discharged_on >= target),
        )
        .order_by(models.Hospitalization.admitted_on)
        .all()
    )
    return {"items": [_hospitalization_dict(h) for h in rows], "total": len(rows)}


@router.get("/api/patients/{karte_no}/hospitalizations")
def api_list_hospitalizations(karte_no: str, db: Session = Depends(get_db)):
    p = _patient_or_404(karte_no, db)
    rows = (
        db.query(models.Hospitalization)
        .filter(models.Hospitalization.patient_id == p.id)
        .order_by(models.Hospitalization.admitted_on.desc())
        .all()
    )
    return {"items": [_hospitalization_dict(h) for h in rows], "total": len(rows)}


@router.post("/api/patients/{karte_no}/hospitalizations", status_code=201)
def api_admit(karte_no: str, body: HospitalizationCreate, db: Session = Depends(get_db)):
    p = _patient_or_404(karte_no, db)
    if body.discharged_on is not None and body.discharged_on < body.admitted_on:
        raise ApiError(
            "invalid_input",
            [{"field": "discharged_on", "message": "退院日は入院日以降にしてください。"}],
        )
    h = models.Hospitalization(
        patient_id=p.id, admitted_on=body.admitted_on,
        discharged_on=body.discharged_on, room=body.room,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _hospitalization_dict(h)


# ── 画面 ─────────────────────────────────────────

@router.get("/animals/{karte_no}/ward", response_class=HTMLResponse)
def animal_ward_screen(karte_no: str, request: Request, db: Session = Depends(get_db)):
    p = _patient_or_404(karte_no, db)
    rows = (
        db.query(models.Hospitalization)
        .filter(models.Hospitalization.patient_id == p.id)
        .order_by(models.Hospitalization.admitted_on.desc())
        .all()
    )
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/animal_ward.html",
        {"patient": p, "hospitalizations": rows, "staff_by_id": staff_by_id, "banner": None},
    )


@router.post("/animals/{karte_no}/ward", response_class=HTMLResponse)
def animal_ward_admit(
    karte_no: str, request: Request, db: Session = Depends(get_db),
    admitted_on: dt.date = Form(...), room: str = Form(""),
):
    """入院の開始。契約：保存の成否によらず200。"""
    templates = request.app.state.templates
    p = _patient_or_404(karte_no, db)
    rows = (
        db.query(models.Hospitalization)
        .filter(models.Hospitalization.patient_id == p.id)
        .order_by(models.Hospitalization.admitted_on.desc())
        .all()
    )
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}

    h = models.Hospitalization(patient_id=p.id, admitted_on=admitted_on, room=room)
    db.add(h)
    db.commit()

    rows = (
        db.query(models.Hospitalization)
        .filter(models.Hospitalization.patient_id == p.id)
        .order_by(models.Hospitalization.admitted_on.desc())
        .all()
    )
    return templates.TemplateResponse(
        request, "ward/animal_ward.html",
        {
            "patient": p, "hospitalizations": rows, "staff_by_id": staff_by_id,
            "banner": ("success", "入院を登録しました。"),
        },
    )


@router.get("/ward/day", response_class=HTMLResponse)
def ward_day_screen(request: Request, date: dt.date | None = None, db: Session = Depends(get_db)):
    target = date or _today_jst()
    rows = (
        db.query(models.Hospitalization)
        .filter(
            models.Hospitalization.admitted_on <= target,
            (models.Hospitalization.discharged_on.is_(None))
            | (models.Hospitalization.discharged_on >= target),
        )
        .order_by(models.Hospitalization.admitted_on)
        .all()
    )
    patient_by_id = {
        p.id: p for p in db.query(models.Patient).all()
    }
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/ward_day.html",
        {"target_date": target, "hospitalizations": rows, "patient_by_id": patient_by_id},
    )


@router.get("/ward", response_class=HTMLResponse)
def ward_screen(request: Request, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Hospitalization)
        .order_by(models.Hospitalization.admitted_on.desc())
        .all()
    )
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/ward.html", {"hospitalizations": rows, "staff_by_id": staff_by_id},
    )
