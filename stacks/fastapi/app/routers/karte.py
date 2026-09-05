"""カルテ画面。`GET /animals/{karte_no}/karte`・その印刷 `.../karte/print`。

いまは表示のみ（screen 組の検算3・4に要る分）。保存・新規診察・前回コピー等は次段階で足す。

検算3・4（`spec/acceptance.md`）の要点:
- `ProgressNote` の4値（体温・脈拍・呼吸・体重）は**行ごとに** `data-check` を付け、
  他の行や他の患者の値と混ざらないこと
- 画面と印刷で、同じ `Visit`・同じキーの値が完全一致すること
  （→ 同じデータ・同じテンプレート変数を2つのテンプレートへ渡すだけにして、
  計算をテンプレート側で分岐させない）
- 削除済み（`deleted_at` あり）の `Visit` は出さない
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.errors import ApiError

router = APIRouter(tags=["screens-clinical"])


def _patient_or_404(karte_no: str, db: Session) -> models.Patient:
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if patient is None:
        raise ApiError("not_found")
    return patient


def _visits(patient: models.Patient, db: Session) -> list[models.Visit]:
    return (
        db.query(models.Visit)
        .filter(models.Visit.patient_id == patient.id, models.Visit.deleted_at.is_(None))
        .order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc())
        .all()
    )


def _render(request: Request, karte_no: str, db: Session, template_name: str) -> HTMLResponse:
    patient = _patient_or_404(karte_no, db)
    visits = _visits(patient, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, template_name, {"patient": patient, "visits": visits},
    )


@router.get("/animals/{karte_no}/karte", response_class=HTMLResponse)
def karte(karte_no: str, request: Request, db: Session = Depends(get_db)):
    return _render(request, karte_no, db, "clinical/karte.html")


@router.get("/animals/{karte_no}/karte/print", response_class=HTMLResponse)
def karte_print(karte_no: str, request: Request, db: Session = Depends(get_db)):
    return _render(request, karte_no, db, "clinical/karte_print.html")
