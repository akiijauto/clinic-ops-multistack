"""会計API。いまは `GET /api/billings/{id}` だけ（money 組の検算2に必要な分）。

金額の計算は `app/billing_calc.py` に1本化してある（丸めの回数を1回に固定するため）。
ここで独自に計算し直さない。

フィールド名について（`coordination/qa/lane-d.md` D-5 参照）:
`spec/openapi.yaml` の `Billing` スキーマは `total` / `taxable_subtotal` /
`nontaxable_subtotal` / `excluded_detail_count` という名前だが、
`spec/acceptance.md` の `data-check` キー表と共通テスト（`tests/checks.py`）は
`net_amount` / `tax_amount` / `total_amount` / `excluded_count` を読む。
共通テストが判定の実体なので、両方の名前を返す（実害が無いため）。
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.billing_calc import DetailLike, calc_billing_totals
from app.db import get_db
from app.errors import ApiError

router = APIRouter(prefix="/api", tags=["api-billing"])


def _clinic(db: Session) -> models.Clinic:
    clinic = db.query(models.Clinic).first()
    if clinic is None:
        raise ApiError("not_found")
    return clinic


def serialize_billing(billing: models.Billing, db: Session) -> dict:
    details = [
        DetailLike(
            quantity=Decimal(str(d.quantity)),
            unit_price=d.unit_price,
            is_taxable=d.is_taxable,
        )
        for d in billing.details
    ]
    totals = calc_billing_totals(details, _clinic(db).tax_rate)

    # openapi.yaml 側の内訳（taxable/nontaxable）も併せて出す。
    taxable_base = Decimal(0)
    nontaxable_base = Decimal(0)
    for d in billing.details:
        if d.unit_price is None:
            continue
        amount = Decimal(str(d.quantity)) * Decimal(d.unit_price)
        if d.is_taxable:
            taxable_base += amount
        else:
            nontaxable_base += amount

    return {
        "id": billing.id,
        "patient_id": billing.patient_id,
        "owner_id": billing.owner_id,
        "slip_no": billing.slip_no,
        "status": billing.status,
        "billed_on": billing.billed_on.isoformat(),
        "staff_id": billing.staff_id,
        "cashier_staff_id": billing.cashier_staff_id,
        "paid_amount": billing.paid_amount,
        "payment_method": billing.payment_method,
        "details": [
            {
                "id": d.id,
                "row_no": d.row_no,
                "price_code": d.price_code,
                "name": d.name,
                "quantity": float(d.quantity),
                "unit_price": d.unit_price,
                "is_taxable": d.is_taxable,
            }
            for d in billing.details
        ],
        # acceptance.md の data-check キー名／共通テストが読む名前（実質の正）。
        "net_amount": totals.net_amount,
        "tax_amount": totals.tax_amount,
        "total_amount": totals.total_amount,
        "excluded_count": totals.excluded_count,
        # openapi.yaml のスキーマ名（互換のため併記）。
        "taxable_subtotal": int(taxable_base),
        "nontaxable_subtotal": int(nontaxable_base),
        "total": totals.total_amount,
        "excluded_detail_count": totals.excluded_count,
    }


@router.get("/billings/{billing_id}")
def get_billing(billing_id: int, db: Session = Depends(get_db)):
    billing = db.get(models.Billing, billing_id)
    if billing is None:
        raise ApiError("not_found")
    return serialize_billing(billing, db)


class BillingDetailIn(BaseModel):
    price_code: str
    name: str
    quantity: float
    unit_price: int | None = None
    is_taxable: bool


class BillingUpdate(BaseModel):
    billed_on: dt.date
    status: str = "draft"
    staff_id: int | None = None
    cashier_staff_id: int | None = None
    paid_amount: int | None = None
    payment_method: str | None = None
    details: list[BillingDetailIn]


@router.patch("/billings/{billing_id}")
def update_billing(billing_id: int, body: BillingUpdate, db: Session = Depends(get_db)):
    """会計伝票の更新（明細の追加・確定・支払い記録）。`BillingCreate` の形で
    明細を**丸ごと入れ替える**（部分パッチではない——契約の `BillingCreate` が
    `details` を配列で必須にしていることに合わせた。行の対応づけを別途受け取る
    形にしていないため、いちばん誤解の余地が無い「置き換え」にした）。

    2026-09-06、レーンR 5巡目の指摘（`coordination/qa/lane-d.md` D-25）で
    405のまま未実装だったことが分かり、追加した。
    """
    billing = db.get(models.Billing, billing_id)
    if billing is None:
        raise ApiError("not_found")
    if body.status not in ("draft", "confirmed"):
        raise ApiError("invalid_input", [{"field": "status", "message": "statusはdraft/confirmedのいずれかです。"}])

    billing.billed_on = body.billed_on
    billing.status = body.status
    billing.staff_id = body.staff_id
    billing.cashier_staff_id = body.cashier_staff_id
    billing.paid_amount = body.paid_amount
    billing.payment_method = body.payment_method

    for d in list(billing.details):
        db.delete(d)
    db.flush()
    for i, d in enumerate(body.details, start=1):
        db.add(models.BillingDetail(
            billing_id=billing.id, row_no=i, price_code=d.price_code, name=d.name,
            quantity=d.quantity, unit_price=d.unit_price, is_taxable=d.is_taxable,
        ))

    db.commit()
    db.refresh(billing)
    return serialize_billing(billing, db)
