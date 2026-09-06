"""カルテ画面。`GET/POST /animals/{karte_no}/karte`・その印刷・新規診察・前回コピー・
取消・診察単位の印刷/削除/復元（`spec/screens.md` 9番）。

検算3・4（`spec/acceptance.md`）の要点:
- `ProgressNote` の4値（体温・脈拍・呼吸・体重）は**行ごとに** `data-check` を付け、
  他の行や他の患者の値と混ざらないこと
- 画面と印刷で、同じ `Visit`・同じキーの値が完全一致すること
  （→ 同じデータ・同じテンプレート変数を2つのテンプレートへ渡すだけにして、
  計算をテンプレート側で分岐させない）
- 削除済み（`deleted_at` あり）の `Visit` は出さない（既定。`show_deleted=1` で見える）

`VisitForm`（openapi）は中身の説明が無い（`description` のみ）ため、フィールド名は
このファイルで仮決めした（`coordination/qa/lane-d.md` D-12 参照）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app import models
from app.config import JST
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


def _visits(patient: models.Patient, db: Session, include_deleted: bool = False) -> list[models.Visit]:
    q = db.query(models.Visit).filter(models.Visit.patient_id == patient.id)
    if not include_deleted:
        q = q.filter(models.Visit.deleted_at.is_(None))
    return q.order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc()).all()


def _visit_or_404(visit_id: int, patient: models.Patient, db: Session) -> models.Visit:
    visit = db.get(models.Visit, visit_id)
    if visit is None or visit.patient_id != patient.id:
        raise ApiError("not_found")
    return visit


def _to_float(raw) -> float | None:
    raw = (raw or "").strip() if isinstance(raw, str) else raw
    if raw in (None, ""):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _to_int(raw) -> int | None:
    raw = (raw or "").strip() if isinstance(raw, str) else raw
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _render(
    request: Request,
    patient: models.Patient,
    db: Session,
    *,
    target: models.Visit | None = None,
    form_values: dict | None = None,
    banner: tuple[str, str] | None = None,
    show_deleted: bool = False,
) -> HTMLResponse:
    visits = _visits(patient, db, include_deleted=show_deleted)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/karte.html",
        {
            "patient": patient,
            "visits": visits,
            "target": target,
            "form_values": form_values,
            "banner": banner,
            "show_deleted": show_deleted,
            "has_prev_visit": bool(_visits(patient, db)),
        },
    )


@router.get("/animals/{karte_no}/karte", response_class=HTMLResponse)
def karte(
    karte_no: str, request: Request, visit_id: int | None = None,
    show_deleted: bool = False, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    target: models.Visit | None = None
    if visit_id is not None:
        target = _visit_or_404(visit_id, patient, db)
    else:
        current = _visits(patient, db)
        target = current[0] if current else None
    return _render(request, patient, db, target=target, show_deleted=show_deleted)


@router.get("/animals/{karte_no}/karte/print", response_class=HTMLResponse)
def karte_print(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    visits = _visits(patient, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/karte_print.html", {"patient": patient, "visits": visits},
    )


@router.get("/animals/{karte_no}/karte/{visit_id}/print", response_class=HTMLResponse)
def visit_print(karte_no: str, visit_id: int, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    visit = _visit_or_404(visit_id, patient, db)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/karte_print.html", {"patient": patient, "visits": [visit]},
    )


@router.get("/animals/{karte_no}/karte/new", response_class=HTMLResponse)
def karte_new(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    return _render(request, patient, db, target=None, form_values={"visit_id": ""})


@router.get("/animals/{karte_no}/karte/copy_prev", response_class=HTMLResponse)
def karte_copy_prev(karte_no: str, request: Request, db: Session = Depends(get_db)):
    """前回コピー。直前の診察が無いときは404
    （ボタン自体は一覧側で灰色にし、その状態では押せない=このルートに来ない想定）。
    """
    patient = _patient_or_404(karte_no, db)
    prev_list = _visits(patient, db)
    if not prev_list:
        raise ApiError("not_found")
    prev = prev_list[0]
    form_values = {
        "visit_id": "",
        "visit_date": prev.visit_date.isoformat(),
        "body_weight_kg": prev.body_weight_kg,
        "chief_complaint": prev.chief_complaint,
        "symptom": prev.symptom,
        "diagnosis": prev.diagnosis,
        "treatment": prev.treatment,
        "staff_id": prev.staff_id,
        "notes": [
            {
                "entry_date": n.entry_date.isoformat(),
                "temperature_c": n.temperature_c,
                "pulse": n.pulse,
                "respiration": n.respiration,
                "body_weight_kg": n.body_weight_kg,
                "symptom_course": n.symptom_course,
                "treatment_rx": n.treatment_rx,
                "note": n.note,
            }
            for n in prev.progress_notes
        ],
    }
    return _render(request, patient, db, target=None, form_values=form_values)


@router.post("/animals/{karte_no}/karte/cancel", response_class=HTMLResponse)
def karte_cancel(karte_no: str, request: Request, db: Session = Depends(get_db)):
    """取消（書きかけの入力を捨てる）。

    この企画には手で押す一時保存が無い（`karte_draft` はB状態）ため、実質は
    「新規診察フォームへ戻す」だけの操作にした（`coordination/qa/lane-d.md` D-13）。
    """
    patient = _patient_or_404(karte_no, db)
    return _render(
        request, patient, db, target=None, form_values={"visit_id": ""},
        banner=("success", "入力を取り消しました。"),
    )


@router.post("/animals/{karte_no}/karte", response_class=HTMLResponse)
async def karte_save(karte_no: str, request: Request, db: Session = Depends(get_db)):
    """カルテ保存（診察本体＋経過記録）。契約: 保存の成否によらず200。

    体温等の4値は行ごとに独立させる（検算3）ため、保存のたびに対象 `Visit` の
    `ProgressNote` を全行入れ替える（部分更新の混線を避ける最も単純な方式）。
    失敗時は打った値をそのままフォームへ返し、確定済みの値で上書きしない。
    """
    patient = _patient_or_404(karte_no, db)
    form = await request.form()

    visit_id_raw = (form.get("visit_id") or "").strip()
    visit_date_raw = (form.get("visit_date") or "").strip()

    errors: list[str] = []
    visit_date: dt.date | None = None
    if not visit_date_raw:
        errors.append("来院日は必須です。")
    else:
        try:
            visit_date = dt.date.fromisoformat(visit_date_raw)
        except ValueError:
            errors.append("来院日の形式が正しくありません。")

    body_weight_kg = _to_float(form.get("body_weight_kg"))
    chief_complaint = (form.get("chief_complaint") or "").strip()
    symptom = (form.get("symptom") or "").strip()
    diagnosis = (form.get("diagnosis") or "").strip()
    treatment = (form.get("treatment") or "").strip()
    staff_id = _to_int(form.get("staff_id"))

    entry_dates = form.getlist("entry_date[]")
    temps = form.getlist("temperature_c[]")
    pulses = form.getlist("pulse[]")
    resps = form.getlist("respiration[]")
    weights = form.getlist("note_body_weight_kg[]")
    courses = form.getlist("symptom_course[]")
    rxs = form.getlist("treatment_rx[]")
    notes_txt = form.getlist("note[]")

    def _at(lst: list, i: int):
        return lst[i] if i < len(lst) else None

    rows: list[dict] = []
    for i, ed_raw in enumerate(entry_dates):
        ed_raw = (ed_raw or "").strip()
        if not ed_raw:
            continue  # 空行は無視（送られなかった行として扱う）
        try:
            ed = dt.date.fromisoformat(ed_raw)
        except ValueError:
            errors.append(f"経過記録{i + 1}行目の日付が正しくありません。")
            continue
        rows.append({
            "row_no": len(rows) + 1,
            "entry_date": ed,
            "temperature_c": _to_float(_at(temps, i)),
            "pulse": _to_int(_at(pulses, i)),
            "respiration": _to_int(_at(resps, i)),
            "body_weight_kg": _to_float(_at(weights, i)),
            "symptom_course": (_at(courses, i) or "").strip(),
            "treatment_rx": (_at(rxs, i) or "").strip(),
            "note": (_at(notes_txt, i) or "").strip(),
        })

    if errors:
        form_values = {
            "visit_id": visit_id_raw,
            "visit_date": visit_date_raw,
            "body_weight_kg": form.get("body_weight_kg") or "",
            "chief_complaint": chief_complaint,
            "symptom": symptom,
            "diagnosis": diagnosis,
            "treatment": treatment,
            "staff_id": form.get("staff_id") or "",
            "notes": [
                {
                    "entry_date": r["entry_date"].isoformat(),
                    "temperature_c": r["temperature_c"],
                    "pulse": r["pulse"],
                    "respiration": r["respiration"],
                    "body_weight_kg": r["body_weight_kg"],
                    "symptom_course": r["symptom_course"],
                    "treatment_rx": r["treatment_rx"],
                    "note": r["note"],
                }
                for r in rows
            ],
        }
        return _render(
            request, patient, db, target=None, form_values=form_values,
            banner=("error", " ".join(errors)),
        )

    if visit_id_raw:
        visit = _visit_or_404(int(visit_id_raw), patient, db)
    else:
        existing = _visits(patient, db, include_deleted=True)
        next_no = (max((v.visit_no for v in existing), default=0)) + 1
        visit = models.Visit(patient_id=patient.id, visit_no=next_no)
        db.add(visit)

    visit.visit_date = visit_date
    visit.body_weight_kg = body_weight_kg
    visit.chief_complaint = chief_complaint
    visit.symptom = symptom
    visit.diagnosis = diagnosis
    visit.treatment = treatment
    visit.staff_id = staff_id
    db.flush()

    for note in list(visit.progress_notes):
        db.delete(note)
    db.flush()
    for r in rows:
        db.add(models.ProgressNote(visit_id=visit.id, **r))

    db.commit()
    db.refresh(visit)

    return _render(request, patient, db, target=visit, banner=("success", "保存しました。"))


@router.post("/animals/{karte_no}/karte/{visit_id}/delete", response_class=HTMLResponse)
def visit_delete(karte_no: str, visit_id: int, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    visit = _visit_or_404(visit_id, patient, db)
    if visit.deleted_at is None:
        visit.deleted_at = dt.datetime.now(JST)
        db.commit()
    return _render(request, patient, db, target=None, banner=("success", "診察を削除しました。"))


@router.post("/animals/{karte_no}/karte/{visit_id}/restore", response_class=HTMLResponse)
def visit_restore(karte_no: str, visit_id: int, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    visit = _visit_or_404(visit_id, patient, db)
    if visit.deleted_at is not None:
        visit.deleted_at = None
        db.commit()
    return _render(
        request, patient, db, target=visit, banner=("success", "診察を復元しました。"),
        show_deleted=True,
    )
