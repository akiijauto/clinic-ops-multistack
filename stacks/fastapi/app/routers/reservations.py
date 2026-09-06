"""予約API + 画面。`spec/acceptance.md` 検算6・`spec/screens.md` 19「予約（新規）」。

重なり判定（半開区間）: `starts_at1 < ends_at2` かつ `starts_at2 < ends_at1` で重なる。
`status = cancelled` は判定に数えない。**担当・処置室の両方**で確認する（片方だけでは
検算6を満たさない）。

担当: サブエージェント「ward-reservations」が `/reservations/new` `/reservations/{id}`
`/reservations/{id}/cancel` を追記した（`coordination/qa/lane-d.md` D-12 以降参照）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.errors import ApiError

router = APIRouter(tags=["api-reservation"])


class ReservationCreate(BaseModel):
    patient_id: int
    starts_at: dt.datetime
    ends_at: dt.datetime
    staff_id: int
    room: str
    purpose: str | None = None
    note: str | None = None


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


def _conflict(db: Session, staff_id: int, room: str, starts_at, ends_at, exclude_id: int | None = None) -> bool:
    q = db.query(models.Reservation).filter(models.Reservation.status == "booked")
    if exclude_id is not None:
        q = q.filter(models.Reservation.id != exclude_id)
    for r in q.all():
        if (r.staff_id == staff_id or r.room == room) and _overlaps(
            starts_at, ends_at, r.starts_at, r.ends_at
        ):
            return True
    return False


def _serialize(r: models.Reservation) -> dict:
    return {
        "id": r.id,
        "patient_id": r.patient_id,
        "starts_at": r.starts_at.isoformat(),
        "ends_at": r.ends_at.isoformat(),
        "staff_id": r.staff_id,
        "room": r.room,
        "purpose": r.purpose,
        "note": r.note,
        "status": r.status,
    }


@router.get("/api/reservations")
def list_reservations(
    db: Session = Depends(get_db),
    staff_id: int | None = None,
    room: str | None = None,
    status: str | None = None,
):
    q = db.query(models.Reservation)
    if staff_id is not None:
        q = q.filter(models.Reservation.staff_id == staff_id)
    if room is not None:
        q = q.filter(models.Reservation.room == room)
    if status is not None:
        q = q.filter(models.Reservation.status == status)
    rows = q.order_by(models.Reservation.starts_at).all()
    return {"items": [_serialize(r) for r in rows], "total": len(rows)}


@router.post("/api/reservations", status_code=201)
def create_reservation(body: ReservationCreate, db: Session = Depends(get_db)):
    if not (body.ends_at > body.starts_at):
        raise ApiError("invalid_input", [{"field": "ends_at", "message": "終了は開始より後にしてください。"}])
    if _conflict(db, body.staff_id, body.room, body.starts_at, body.ends_at):
        raise ApiError("reservation_conflict")
    r = models.Reservation(
        patient_id=body.patient_id, starts_at=body.starts_at, ends_at=body.ends_at,
        staff_id=body.staff_id, room=body.room, purpose=body.purpose or "",
        note=body.note or "", status="booked",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.get("/api/reservations/{reservation_id}")
def get_reservation(reservation_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    return _serialize(r)


@router.patch("/api/reservations/{reservation_id}")
def update_reservation(reservation_id: int, body: ReservationCreate, db: Session = Depends(get_db)):
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    if not (body.ends_at > body.starts_at):
        raise ApiError("invalid_input", [{"field": "ends_at", "message": "終了は開始より後にしてください。"}])
    if _conflict(db, body.staff_id, body.room, body.starts_at, body.ends_at, exclude_id=r.id):
        raise ApiError("reservation_conflict")
    r.patient_id = body.patient_id
    r.starts_at = body.starts_at
    r.ends_at = body.ends_at
    r.staff_id = body.staff_id
    r.room = body.room
    r.purpose = body.purpose or ""
    r.note = body.note or ""
    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.post("/api/reservations/{reservation_id}/cancel")
def cancel_reservation(reservation_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    r.status = "cancelled"
    db.commit()
    db.refresh(r)
    return _serialize(r)


# ── 画面 ─────────────────────────────────────────

def _staff_active(db: Session) -> list[models.Staff]:
    return (
        db.query(models.Staff)
        .filter(models.Staff.is_active.is_(True))
        .order_by(models.Staff.staff_code)
        .all()
    )


def _patient_by_karte_no(karte_no: str, db: Session) -> models.Patient | None:
    if not karte_no:
        return None
    return (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )


@router.get("/reservations", response_class=HTMLResponse)
def reservations_screen(request: Request, db: Session = Depends(get_db)):
    rows = db.query(models.Reservation).order_by(models.Reservation.starts_at).all()
    patient_by_id = {p.id: p.name_kanji for p in db.query(models.Patient).all()}
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/reservations.html",
        {"reservations": rows, "patient_by_id": patient_by_id, "staff_by_id": staff_by_id, "banner": None},
    )


@router.post("/reservations", response_class=HTMLResponse)
def reservations_create_screen(
    request: Request, db: Session = Depends(get_db),
    karte_no: str = Form(""), starts_at: dt.datetime = Form(...), ends_at: dt.datetime = Form(...),
    staff_id: int = Form(...), room: str = Form(""), purpose: str = Form(""), note: str = Form(""),
):
    """予約（新）登録。契約：保存の成否によらず200、重複は error-banner に文言を出す。"""
    templates = request.app.state.templates

    def _render(banner):
        rows = db.query(models.Reservation).order_by(models.Reservation.starts_at).all()
        patient_by_id = {p.id: p.name_kanji for p in db.query(models.Patient).all()}
        staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
        return templates.TemplateResponse(
            request, "ward/reservations.html",
            {"reservations": rows, "patient_by_id": patient_by_id, "staff_by_id": staff_by_id, "banner": banner},
        )

    patient = _patient_by_karte_no(karte_no, db)
    if patient is None:
        return _render(("error", "指定されたカルテNoの動物が見つかりません。"))
    if not (ends_at > starts_at):
        return _render(("error", "終了は開始より後にしてください。"))
    if _conflict(db, staff_id, room, starts_at, ends_at):
        return _render(("error", "指定した時間帯は、担当または処置室の予定と重なっています。"))

    r = models.Reservation(
        patient_id=patient.id, starts_at=starts_at, ends_at=ends_at,
        staff_id=staff_id, room=room, purpose=purpose, note=note, status="booked",
    )
    db.add(r)
    db.commit()
    return _render(("success", "予約を登録しました。"))


@router.get("/reservations/new", response_class=HTMLResponse)
def reservation_new_screen(request: Request, karte_no: str | None = None, db: Session = Depends(get_db)):
    patient = _patient_by_karte_no(karte_no or "", db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/reservation_new.html",
        {"patient": patient, "karte_no": karte_no or "", "staff_list": _staff_active(db), "banner": None},
    )


@router.get("/reservations/{reservation_id}", response_class=HTMLResponse)
def reservation_detail_screen(reservation_id: int, request: Request, db: Session = Depends(get_db)):
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    patient = db.get(models.Patient, r.patient_id)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/reservation_detail.html",
        {"reservation": r, "patient": patient, "staff_list": _staff_active(db), "banner": None},
    )


@router.post("/reservations/{reservation_id}", response_class=HTMLResponse)
def reservation_update_screen(
    reservation_id: int, request: Request, db: Session = Depends(get_db),
    karte_no: str = Form(""), starts_at: dt.datetime = Form(...), ends_at: dt.datetime = Form(...),
    staff_id: int = Form(...), room: str = Form(""), purpose: str = Form(""), note: str = Form(""),
):
    """予約（新）変更。契約：保存の成否によらず200。"""
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    templates = request.app.state.templates
    patient = _patient_by_karte_no(karte_no, db) or db.get(models.Patient, r.patient_id)

    def _render(banner):
        return templates.TemplateResponse(
            request, "ward/reservation_detail.html",
            {"reservation": r, "patient": patient, "staff_list": _staff_active(db), "banner": banner},
        )

    if not (ends_at > starts_at):
        return _render(("error", "終了は開始より後にしてください。"))
    if _conflict(db, staff_id, room, starts_at, ends_at, exclude_id=r.id):
        return _render(("error", "指定した時間帯は、担当または処置室の予定と重なっています。"))
    if patient is None:
        return _render(("error", "指定されたカルテNoの動物が見つかりません。"))

    r.patient_id = patient.id
    r.starts_at = starts_at
    r.ends_at = ends_at
    r.staff_id = staff_id
    r.room = room
    r.purpose = purpose
    r.note = note
    db.commit()
    db.refresh(r)
    return _render(("success", "予約を更新しました。"))


@router.post("/reservations/{reservation_id}/cancel", response_class=HTMLResponse)
def reservation_cancel_screen(reservation_id: int, request: Request, db: Session = Depends(get_db)):
    r = db.get(models.Reservation, reservation_id)
    if r is None:
        raise ApiError("not_found")
    r.status = "cancelled"
    db.commit()
    db.refresh(r)
    patient = db.get(models.Patient, r.patient_id)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/reservation_cancel.html",
        {"reservation": r, "patient": patient, "banner": ("success", "予約を取り消しました。")},
    )
