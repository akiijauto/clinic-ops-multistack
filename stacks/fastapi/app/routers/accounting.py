"""会計画面（screens.md 14番）。`GET/POST /animals/{karte_no}/accounting`。

金額計算は `app/billing_calc.py` に1本化（丸めは表示直前の1回だけ）。
一覧・履歴用のシリアライズは `app/routers/billing.py` の `serialize_billing` を使い、
画面とAPIで計算ロジックを分けない（検算4「画面と印刷が一致」と同じ考え方の応用）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app import fixtures, models
from app.config import JST
from app.db import get_db
from app.errors import ApiError
from app.routers.billing import serialize_billing

router = APIRouter(tags=["screens-billing"])


def _patient_or_404(karte_no: str, db: Session) -> models.Patient:
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if patient is None:
        raise ApiError("not_found")
    return patient


def _current_billing(patient: models.Patient, slip: int | None, db: Session) -> models.Billing:
    """`slip` 指定があればその伝票、無ければ当日の draft を開くか新規に作る。"""
    if slip is not None:
        billing = db.get(models.Billing, slip)
        if billing is None or billing.patient_id != patient.id:
            raise ApiError("not_found")
        return billing

    draft = (
        db.query(models.Billing)
        .filter(models.Billing.patient_id == patient.id, models.Billing.status == "draft")
        .order_by(models.Billing.id.desc())
        .first()
    )
    if draft is not None:
        return draft

    draft = models.Billing(
        patient_id=patient.id, owner_id=patient.owner_id,
        status="draft", billed_on=dt.datetime.now(JST).date(),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def _render(request: Request, karte_no: str, billing: models.Billing, db: Session, banner=None):
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "billing/accounting.html",
        {
            "karte_no": karte_no,
            "billing": serialize_billing(billing, db),
            "raw_billing": billing,
            "price_items": fixtures.price_items(),
            "banner": banner,
        },
    )


@router.get("/animals/{karte_no}/accounting", response_class=HTMLResponse)
def accounting_screen(
    karte_no: str, request: Request, slip: int | None = None, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    billing = _current_billing(patient, slip, db)
    return _render(request, karte_no, billing, db)


@router.post("/animals/{karte_no}/accounting", response_class=HTMLResponse)
def accounting_save(
    karte_no: str,
    request: Request,
    db: Session = Depends(get_db),
    action: str = Form(...),
    slip: int | None = Form(None),
    price_code: str = Form(""),
    quantity: float = Form(1),
    detail_id: int | None = Form(None),
):
    """`action`: add_detail / duplicate_detail / delete_detail / clear_all / confirm

    契約: 保存の成否によらず200。確定済み(`confirmed`)の伝票は明細操作をすべて拒否する。
    """
    patient = _patient_or_404(karte_no, db)
    billing = _current_billing(patient, slip, db)

    def locked() -> bool:
        return billing.status == "confirmed"

    if action == "add_detail":
        if locked():
            return _render(request, karte_no, billing, db, banner=("error", "確定済みの伝票は明細を追加できません。"))
        item = fixtures.price_item_by_code(price_code)
        if item is None:
            return _render(request, karte_no, billing, db, banner=("error", "料金項目が見つかりません。"))
        next_row_no = (max((d.row_no for d in billing.details), default=0)) + 1
        db.add(models.BillingDetail(
            billing_id=billing.id, row_no=next_row_no, price_code=item["price_code"],
            name=item["name"], quantity=quantity, unit_price=item.get("unit_price"),
            is_taxable=item.get("is_taxable", True),
        ))
        db.commit()
        db.refresh(billing)
        return _render(request, karte_no, billing, db, banner=("success", "明細を追加しました。"))

    if action in ("duplicate_detail", "delete_detail"):
        if locked():
            return _render(request, karte_no, billing, db, banner=("error", "確定済みの伝票は明細を変更できません。"))
        detail = db.get(models.BillingDetail, detail_id) if detail_id else None
        if detail is None or detail.billing_id != billing.id:
            return _render(request, karte_no, billing, db, banner=("error", "対象の明細が見つかりません。"))
        if action == "duplicate_detail":
            next_row_no = (max((d.row_no for d in billing.details), default=0)) + 1
            db.add(models.BillingDetail(
                billing_id=billing.id, row_no=next_row_no, price_code=detail.price_code,
                name=detail.name, quantity=detail.quantity, unit_price=detail.unit_price,
                is_taxable=detail.is_taxable,
            ))
        else:
            db.delete(detail)
        db.commit()
        db.refresh(billing)
        return _render(request, karte_no, billing, db, banner=("success", "更新しました。"))

    if action == "clear_all":
        if locked():
            return _render(request, karte_no, billing, db, banner=("error", "確定済みの伝票は全削除できません。"))
        for d in list(billing.details):
            db.delete(d)
        db.commit()
        db.refresh(billing)
        return _render(request, karte_no, billing, db, banner=("success", "明細をすべて取り消しました。"))

    if action == "confirm":
        if locked():
            return _render(request, karte_no, billing, db, banner=("error", "既に確定済みです。"))
        if not billing.details:
            return _render(request, karte_no, billing, db, banner=("error", "明細が1行も無い伝票は確定できません。"))
        billing.status = "confirmed"
        billing.slip_no = f"B-{billing.billed_on.strftime('%Y%m%d')}-{billing.id:04d}"
        db.commit()
        db.refresh(billing)
        return _render(request, karte_no, billing, db, banner=("success", "確定しました。"))

    return _render(request, karte_no, billing, db, banner=("error", "不明な操作です。"))


@router.get("/animals/{karte_no}/accounting/history", response_class=HTMLResponse)
def accounting_history(
    karte_no: str, request: Request, scope: str = "patient", db: Session = Depends(get_db),
):
    """会計履歴（screens.md 15番）。動物／飼主／全体の3範囲。既定は動物。"""
    patient = _patient_or_404(karte_no, db)

    query = db.query(models.Billing)
    if scope == "owner":
        query = query.filter(models.Billing.owner_id == patient.owner_id)
    elif scope == "all":
        pass
    else:
        scope = "patient"
        query = query.filter(models.Billing.patient_id == patient.id)

    billings = query.order_by(models.Billing.billed_on.desc(), models.Billing.id.desc()).all()
    rows = [serialize_billing(b, db) for b in billings]

    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "billing/accounting_history.html",
        {"karte_no": karte_no, "scope": scope, "rows": rows, "current_patient_id": patient.id},
    )
