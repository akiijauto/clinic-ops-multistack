"""売上集計API。`GET /api/sales/summary`。

フィールド形について（`coordination/qa/lane-d.md` D-5）:
`spec/openapi.yaml` の `SalesSummary` は `from`/`to` を必須クエリにし、
`group_by` で1軸だけ返す形だが、共通テスト（`tests/checks.py` の検算1）は
クエリ無しで叩き、`by_category`/`by_staff`/`by_date` の3軸を**同時に**、
かつ分類別の各行に `share_pct` を求めている。共通テストが判定の実体なので、
そちらの形を主に返す（`from`/`to` は任意にし、渡されれば絞り込みに使う）。

3方向一致・構成比の計算規則は `spec/acceptance.md`「検算1」「数値の規則」のとおり:
- 対象は `Billing.status = confirmed` のみ
- `unit_price` 未設定の明細はどの合計にも入れない
- 担当は `staff_id`（`cashier_staff_id` ではない）
- 構成比は最大剰余法（`app/billing_calc.allocate_share_pct`）
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import fixtures, models
from app.billing_calc import allocate_share_pct
from app.db import get_db

router = APIRouter(prefix="/api", tags=["api-billing"])


def _category_major(price_code: str) -> str | None:
    item = fixtures.price_item_by_code(price_code)
    if not item:
        return None
    return item.get("category_major") or item.get("category")


def compute_summary(db: Session, date_from: str | None = None, date_to: str | None = None) -> dict:
    """`/sales` 画面（`app/routers/front.py`）とAPIが共有する集計本体。

    2箇所に書き写すと片方だけ直し忘れる事故が起きるので、ここへ1本化した
    （`_visit_macro.html` を画面と印刷で共有したのと同じ考え方）。
    """
    billings = db.query(models.Billing).filter(models.Billing.status == "confirmed").all()

    by_cat: dict[str, Decimal] = defaultdict(Decimal)
    by_staff: dict[int, Decimal] = defaultdict(Decimal)
    by_date: dict[str, Decimal] = defaultdict(Decimal)
    excluded_total = 0
    total = Decimal(0)

    for b in billings:
        day = b.billed_on.isoformat()
        if date_from and day < date_from:
            continue
        if date_to and day > date_to:
            continue
        for d in b.details:
            if d.unit_price is None:
                excluded_total += 1
                continue
            amount = Decimal(str(d.quantity)) * Decimal(d.unit_price)
            total += amount
            by_date[day] += amount
            by_staff[b.staff_id] += amount
            cat = _category_major(d.price_code)
            if cat is not None:
                by_cat[cat] += amount

    cat_rows = allocate_share_pct(list(by_cat.items()))

    return {
        # 共通テストが読む名前。
        "total_net_amount": int(total),
        "by_category": [
            {"category": r.key, "net_amount": r.net_amount, "share_pct": r.share_pct}
            for r in cat_rows
        ],
        "by_staff": [
            {"staff_id": k, "net_amount": int(v)} for k, v in by_staff.items()
        ],
        "by_date": [
            {"date": k, "net_amount": int(v)} for k, v in by_date.items()
        ],
        # openapi.yaml 側の名前（互換のため併記）。
        "total": int(total),
        "total_amount": int(total),
        "excluded_detail_count_total": excluded_total,
        "from": date_from,
        "to": date_to,
    }


@router.get("/sales/summary")
def sales_summary(
    db: Session = Depends(get_db),
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
):
    return compute_summary(db, date_from, date_to)
