"""スタッフ一覧API。担当: サブエージェント「ward-reservations」。

`spec/openapi.yaml` の /api/staff を実装する場所。

`/postal`（郵便番号→住所候補）は `/api` プレフィックスの付かない別ルートなので、
`no_prefix_router` に足した（2026-09-06、レーン本体が新しい在庫検査で漏れに
気づいて追加。担当外だが `/api/staff` と同じ「参照系の小さなAPI」枠のためここに置いた）。
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.errors import ApiError

router = APIRouter(prefix="/api", tags=["api-misc"])
no_prefix_router = APIRouter(tags=["api-misc"])


def _staff_dict(s: models.Staff) -> dict:
    return {
        "id": s.id,
        "staff_code": s.staff_code,
        "name": s.name,
        "role": s.role,
        "is_active": s.is_active,
    }


@router.get("/staff")
def list_staff(is_active: bool | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Staff)
    if is_active is not None:
        q = q.filter(models.Staff.is_active.is_(is_active))
    rows = q.order_by(models.Staff.staff_code).all()
    return {"items": [_staff_dict(s) for s in rows], "total": len(rows)}


_POSTAL_RE = re.compile(r"^\d{3}-?\d{4}$")


@no_prefix_router.get("/postal")
def postal_lookup(code: str = Query(...)):
    """郵便番号から住所候補を引く。

    **この実装には住所マスタが無い**（`data/` に郵便番号→住所の対応表が存在しない）。
    形式チェックだけ行い、形式が正しければ「候補が無い」を契約どおりの形
    （`candidates: []`, `reason` に理由）で返す。形式が壊れていれば422。
    """
    if not _POSTAL_RE.match(code.strip()):
        raise ApiError("invalid_input", [{"field": "code", "message": "郵便番号の形式が正しくありません。"}])
    return {"candidates": [], "reason": "住所候補のデータを持っていません（この実装は郵便番号マスタを持たない）。"}
