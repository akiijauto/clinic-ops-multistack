"""検査API。`GET /api/lab-tests/{id}`（screen 組の検算5に要る分）。

フィールド名について（`coordination/qa/lane-d.md` D-7）:
`spec/openapi.yaml` の `LabTestItem` は `judgement`（英）で
`low`/`normal`/`high`/`unknown` を返す形だが、共通テスト（`tests/checks.py`）は
`judgment`（米）で空文字/`H`/`L` を読む。billing/sales と同じ構図（D-5）なので、
共通テストの名前を主に、openapi.yaml 側の名前（`judgement`）も併記する。

判定の規則は `spec/acceptance.md`「検算5」のとおり:
- `min ≦ value_num ≦ max` は範囲内（両端を含む）
- 範囲外は `H`（> max）/ `L`（< min）
- 基準値の組み合わせが無い、または `value_num` が無い（`value_text` のみ）行は対象外
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import fixtures, models
from app.db import get_db
from app.errors import ApiError

router = APIRouter(prefix="/api", tags=["api-clinical"])


def _judge(item: models.LabTestItem, patient: models.Patient | None) -> tuple[str, str, float | None, float | None]:
    """戻り値: (judgment: ''/'H'/'L', flag: normal/high/low/unknown, ref_low, ref_high)"""
    if item.value_num is None or patient is None:
        return "", "unknown", None, None
    rng = fixtures.lab_reference_range(item.item_code, patient.species, patient.sex)
    if rng is None:
        return "", "unknown", None, None
    low, high = rng.get("low"), rng.get("high")
    value = float(item.value_num)
    if high is not None and value > high:
        return "H", "high", low, high
    if low is not None and value < low:
        return "L", "low", low, high
    return "", "normal", low, high


@router.get("/lab-tests/{lab_test_id}")
def get_lab_test(lab_test_id: int, db: Session = Depends(get_db)):
    test = db.get(models.LabTest, lab_test_id)
    if test is None:
        raise ApiError("not_found")
    patient = db.get(models.Patient, test.patient_id)

    items = []
    for it in test.items:
        judgment, flag, low, high = _judge(it, patient)
        items.append({
            "id": it.id,
            "lab_test_id": it.lab_test_id,
            "item_code": it.item_code,
            "value_num": float(it.value_num) if it.value_num is not None else None,
            "value_text": it.value_text,
            "reference_low": low,
            "reference_high": high,
            # 共通テストが読む名前（acceptance.md/checks.py）。
            "judgment": judgment,
            "flag": flag,
            # openapi.yaml のスキーマ名（互換）。値そのものは flag と同じ語彙。
            "judgement": flag,
        })

    return {
        "id": test.id,
        "patient_id": test.patient_id,
        "visit_id": test.visit_id,
        "category": test.category,
        "tested_on": test.tested_on.isoformat(),
        "tested_at_time": test.tested_at_time,
        "staff_id": test.staff_id,
        "items": items,
    }
