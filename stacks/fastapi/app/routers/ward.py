"""入院API + 画面。`spec/acceptance.md` 検算7・`spec/screens.md` 18「入院」。

**実施者（`performed_by_staff_id`）は必須。** 無い記録行は作らせない（422）。
退院済み（`discharged_on` あり）の入院には新しいケア記録を追加できない
（`spec/screens.md` 18「満たすべきこと」）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.errors import ApiError

router = APIRouter(tags=["api-ward"])


class CareRecordCreate(BaseModel):
    recorded_at: dt.datetime
    category: str
    content: str | None = None
    performed_by_staff_id: int | None = None


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


# ── 画面 ─────────────────────────────────────────

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
