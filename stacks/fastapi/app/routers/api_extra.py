"""会計・DMの残りAPI。担当: サブエージェント「accounting-dm」。

`spec/openapi.yaml` の以下を実装する場所（api-billing / api-misc相当。画面は既存で足りている
ため、ここはAPIのみ）:

- /api/patients/{karte_no}/billings
- /api/owners/{owner_no}/billings
- /api/billings
- /api/dm

`app/routers/billing.py` の `serialize_billing(billing, db)` を再利用すること
（金額計算を書き写さない）。

仮決め・食い違いは `coordination/qa/lane-d.md` の D-12以降を参照。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.errors import ApiError
from app.routers.billing import serialize_billing

router = APIRouter(prefix="/api", tags=["api-billing"])


@router.get("/patients/{karte_no}/billings")
def list_patient_billings(
    karte_no: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if patient is None:
        raise ApiError("not_found")
    q = (
        db.query(models.Billing)
        .filter(models.Billing.patient_id == patient.id)
        .order_by(models.Billing.billed_on.desc(), models.Billing.id.desc())
    )
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {"items": [serialize_billing(b, db) for b in rows], "total": total}


@router.get("/owners/{owner_no}/billings")
def list_owner_billings(
    owner_no: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    owner = (
        db.query(models.Owner)
        .filter(models.Owner.owner_no == owner_no, models.Owner.deleted_at.is_(None))
        .first()
    )
    if owner is None:
        raise ApiError("not_found")
    q = (
        db.query(models.Billing)
        .filter(models.Billing.owner_id == owner.id)
        .order_by(models.Billing.billed_on.desc(), models.Billing.id.desc())
    )
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {"items": [serialize_billing(b, db) for b in rows], "total": total}


@router.get("/billings")
def list_billings(
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    # `from` はPythonの予約語なのでクエリ名としてそのまま引数名にできない。
    # エイリアスで受ける（app/routers/sales.py の書き方に倣う）。
    q = db.query(models.Billing)
    if from_ is not None:
        q = q.filter(models.Billing.billed_on >= from_)
    if to is not None:
        q = q.filter(models.Billing.billed_on <= to)
    q = q.order_by(models.Billing.billed_on.desc(), models.Billing.id.desc())
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {"items": [serialize_billing(b, db) for b in rows], "total": total}


@router.get("/dm")
def list_dm(
    type: int | None = None,
    field: str = "next_due_date",
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """DM対象の一覧。`front.py` の `dm_screen` と同じ絞り込み方針
    （`Prevention.next_due_date is not None`）に、契約のクエリ（type/field/from/to）を足す。

    `type` は `Prevention` の何を指すか契約本文に定義が無い（D-12参照）ため、
    ここでは絞り込みには使わない（受け取るだけで無視しても契約上のレスポンス形は満たす）。
    """
    date_col = models.Prevention.performed_date if field == "performed_date" else models.Prevention.next_due_date

    q = db.query(models.Prevention).filter(models.Prevention.next_due_date.is_not(None))
    if from_ is not None:
        q = q.filter(date_col.is_not(None), date_col >= from_)
    if to is not None:
        q = q.filter(date_col.is_not(None), date_col <= to)
    q = q.order_by(models.Prevention.next_due_date)

    rows = q.all()
    patient_by_id = {
        p.id: p
        for p in db.query(models.Patient).filter(models.Patient.deleted_at.is_(None)).all()
    }
    owner_by_id = {
        o.id: o
        for o in db.query(models.Owner).filter(models.Owner.deleted_at.is_(None)).all()
    }

    items = []
    for r in rows:
        patient = patient_by_id.get(r.patient_id)
        if patient is None:
            continue
        owner = owner_by_id.get(patient.owner_id)
        if owner is None:
            continue
        items.append({
            "karte_no": patient.karte_no,
            "owner_name_kanji": owner.name_kanji,
            "patient_name_kanji": patient.name_kanji,
            "kind": r.kind,
            "next_due_date": r.next_due_date.isoformat() if r.next_due_date else None,
            "performed_date": r.performed_date.isoformat() if r.performed_date else None,
        })

    return {"items": items, "total": len(items)}
