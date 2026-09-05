"""予約API + 画面。`spec/acceptance.md` 検算6・`spec/screens.md` 19「予約（新規）」。

重なり判定（半開区間）: `starts_at1 < ends_at2` かつ `starts_at2 < ends_at1` で重なる。
`status = cancelled` は判定に数えない。**担当・処置室の両方**で確認する（片方だけでは
検算6を満たさない）。
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

@router.get("/reservations", response_class=HTMLResponse)
def reservations_screen(request: Request, db: Session = Depends(get_db)):
    rows = db.query(models.Reservation).order_by(models.Reservation.starts_at).all()
    patient_by_id = {p.id: p.name_kanji for p in db.query(models.Patient).all()}
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "ward/reservations.html",
        {"reservations": rows, "patient_by_id": patient_by_id, "staff_by_id": staff_by_id},
    )
