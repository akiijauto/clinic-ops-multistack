"""検査API。`GET /api/lab-tests/{id}`（screen 組の検算5に要る分）＋
`GET/POST /api/patients/{karte_no}/lab-tests`（この動物の検査一覧・新規保存）。

フィールド名について（`coordination/qa/lane-d.md` D-7）:
`spec/openapi.yaml` の `LabTestItem` は `judgement`（英）で
`low`/`normal`/`high`/`unknown` を返す形だが、共通テスト（`tests/checks.py`）は
`judgment`（米）で空文字/`H`/`L` を読む。billing/sales と同じ構図（D-5）なので、
共通テストの名前を主に、openapi.yaml 側の名前（`judgement`）も併記する。

判定の規則は `spec/acceptance.md`「検算5」のとおり:
- `min ≦ value_num ≦ max` は範囲内（両端を含む）
- 範囲外は `H`（> max）/ `L`（< min）
- 基準値の組み合わせが無い、または `value_num` が無い（`value_text` のみ）行は対象外

`LabTestCreate` の保存: 基準値・判定はサーバが計算して**返すだけ**（保存しない）。
実測値（`value_num`/`value_text`）だけを `LabTestItem` に保存する（`openapi.yaml` の
`api_create_lab_test` description のとおり）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
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


def _serialize_lab_test(test: models.LabTest, patient: models.Patient | None) -> dict:
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


def _patient_by_karte_no_or_404(karte_no: str, db: Session) -> models.Patient:
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if patient is None:
        raise ApiError("not_found")
    return patient


@router.get("/lab-tests/{lab_test_id}")
def get_lab_test(lab_test_id: int, db: Session = Depends(get_db)):
    test = db.get(models.LabTest, lab_test_id)
    if test is None:
        raise ApiError("not_found")
    patient = db.get(models.Patient, test.patient_id)
    return _serialize_lab_test(test, patient)


@router.get("/patients/{karte_no}/lab-tests")
def list_lab_tests(karte_no: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    patient = _patient_by_karte_no_or_404(karte_no, db)
    query = (
        db.query(models.LabTest)
        .filter(models.LabTest.patient_id == patient.id)
        .order_by(models.LabTest.tested_on.desc(), models.LabTest.id.desc())
    )
    total = query.count()
    rows = query.offset(offset).limit(limit).all()
    return {"items": [_serialize_lab_test(t, patient) for t in rows], "total": total}


class LabTestItemCreate(BaseModel):
    item_code: str
    value_num: float | None = None
    value_text: str | None = None


class LabTestCreateBody(BaseModel):
    visit_id: int
    category: str
    tested_on: dt.date
    tested_at_time: str | None = None
    staff_id: int | None = None
    items: list[LabTestItemCreate]


@router.post("/patients/{karte_no}/lab-tests", status_code=201)
def create_lab_test(karte_no: str, body: LabTestCreateBody, db: Session = Depends(get_db)):
    """検査結果を保存する。基準値・判定は保存せず、返り値にのみ計算して付ける。"""
    patient = _patient_by_karte_no_or_404(karte_no, db)

    visit = db.get(models.Visit, body.visit_id)
    if visit is None or visit.patient_id != patient.id:
        raise ApiError("not_found")

    if not body.items:
        raise ApiError(
            "invalid_input", [{"field": "items", "message": "検査項目が1件も指定されていません。"}],
        )

    test = models.LabTest(
        patient_id=patient.id, visit_id=body.visit_id, category=body.category,
        tested_on=body.tested_on, tested_at_time=body.tested_at_time or "",
        staff_id=body.staff_id,
    )
    db.add(test)
    db.flush()
    for it in body.items:
        db.add(models.LabTestItem(
            lab_test_id=test.id, item_code=it.item_code,
            value_num=it.value_num, value_text=it.value_text,
        ))
    db.commit()
    db.refresh(test)
    return _serialize_lab_test(test, patient)
