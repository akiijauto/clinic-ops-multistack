"""診療ドメインの残り。担当: サブエージェント「clinical-detail」。

`spec/openapi.yaml` の以下を実装する場所（screens-clinical / api-clinical。
カルテ本体・診察一覧・削除・復元は `app/routers/karte.py` を拡張して書いてある):

- 画面: /animals/{karte_no}/exam, /animals/{karte_no}/dosing/{kind_id},
  /animals/{karte_no}/prevention/{kind_id}, /animals/{karte_no}/papers,
  /papers/{paper_id}, /papers/{paper_id}/remove, /papers/no-paper
- API: /api/patients/{karte_no}/dosing/{kind_id}, /api/patients/{karte_no}/prevention/{kind_id},
  /api/patients/{karte_no}/papers, /api/papers/{paper_id}
  （/api/patients/{karte_no}/lab-tests は app/routers/lab.py に足した）

種別（kind_id）の扱い（`coordination/qa/lane-d.md` D-13, 裁定R-23）:
`DosingKindId` / `PreventionKindId` は `data/masters.json` の `prevention_kinds`
リストへの1始まりのインデックス、**または** そのリストの `code`（例: `"heartworm"`）
のどちらでも引けるようにしてある（`_resolve_kind_index` に集約）。
`dosing_kinds` という独立マスタがデータ側に存在しないための代用。
契約は `kind_id` を integer とだけ型付けしているが、`data/seed.json` に数値idが無く
文字列コードしか無いという契約・データ間の食い違いが裁定R-23で確定したため、
パスパラメータ自体は `str` で受け、両対応を1関数に集約している。範囲外・
一致無しは404 `not_found`。

予防の「基本周期」（`coordination/qa/lane-d.md` D-14）:
`data/masters.json` の `prevention_kinds` には周期の列が無い。よって全種別を
「周期未設定」として扱い、次回予定日を空で保存した場合は常に空のまま保存する
（`spec/screens.md` 12番の「周期が未設定なら次回予定日は空のまま保存される」の分岐）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import fixtures, models
from app.config import JST, jst_isoformat
from app.db import get_db
from app.errors import ApiError
from app.routers.lab import _serialize_lab_test

router = APIRouter()


# ── 共通ヘルパ ───────────────────────────────────────────────

def _patient_or_404(karte_no: str, db: Session) -> models.Patient:
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.karte_no == karte_no, models.Patient.deleted_at.is_(None))
        .first()
    )
    if patient is None:
        raise ApiError("not_found")
    return patient


def _prevention_kinds() -> list[dict]:
    return fixtures.masters().get("prevention_kinds", [])


def _resolve_kind_index(kind_id: str) -> int | None:
    """`kind_id` を `prevention_kinds` のインデックス（0始まり）に解決する。

    裁定R-23（`coordination/qa/lane-d.md`）: `spec/openapi.yaml` は `kind_id` を
    integer と型付けしているが、`data/seed.json` には数値idが無く文字列コード
    （`"heartworm"` 等）しか無い——契約とデータの食い違い。Go/Laravel/Next.jsの
    3レーンが独立に「数値idを先に試し、ダメならコードで引く」に到達したため、
    ここでも同じ解決にする。パスパラメータ自体は `str` で受け、この関数の中だけで
    数値／コードの両対応を吸収する（後方互換: 既存の数値idでの呼び出しは壊さない）。
    """
    kinds = _prevention_kinds()
    raw = (kind_id or "").strip()
    if raw.isdigit():
        idx = int(raw) - 1
        if 0 <= idx < len(kinds):
            return idx
        return None
    for i, k in enumerate(kinds):
        if k.get("code") == raw:
            return i
    return None


def _kind_code_or_404(kind_id: str) -> str:
    idx = _resolve_kind_index(kind_id)
    if idx is None:
        raise ApiError("not_found")
    return _prevention_kinds()[idx]["code"]


def _kind_name(kind_id: str) -> str:
    idx = _resolve_kind_index(kind_id)
    if idx is None:
        return ""
    kinds = _prevention_kinds()
    return kinds[idx].get("name", kinds[idx]["code"])


def _to_int(raw) -> int | None:
    raw = (raw or "").strip() if isinstance(raw, str) else raw
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _dosing_dict(row: models.Dosing) -> dict:
    return {
        "id": row.id,
        "patient_id": row.patient_id,
        "kind": row.kind,
        "fiscal_year": row.fiscal_year,
        **{f"m{m:02d}": getattr(row, f"m{m:02d}") for m in range(1, 13)},
    }


def _prevention_dict(row: models.Prevention) -> dict:
    return {
        "id": row.id,
        "patient_id": row.patient_id,
        "kind": row.kind,
        "content": row.content,
        "performed_date": row.performed_date.isoformat(),
        "next_due_date": row.next_due_date.isoformat() if row.next_due_date else None,
        "staff_id": row.staff_id,
    }


def _paper_dict(row: models.Paper) -> dict:
    return {
        "id": row.id,
        "patient_id": row.patient_id,
        "title": row.title,
        "note": row.note,
        "created_at": jst_isoformat(row.created_at),
        # openapi.yaml の Paper スキーマには無い項目だが、論理削除（下記）を外から
        # 見えるようにするために付けた（billing.py が互換名を併記するのと同じ考え方）。
        "removed_at": jst_isoformat(row.removed_at) if row.removed_at else None,
    }


# ============================================================
# 画面 — 検査
# ============================================================

@router.get("/animals/{karte_no}/exam", response_class=HTMLResponse)
def exam_screen(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    tests = (
        db.query(models.LabTest)
        .filter(models.LabTest.patient_id == patient.id)
        .order_by(models.LabTest.tested_on.desc(), models.LabTest.id.desc())
        .all()
    )
    items_master = fixtures.lab_items()
    item_by_code = {i["item_code"]: i for i in items_master}
    latest_visit = (
        db.query(models.Visit)
        .filter(models.Visit.patient_id == patient.id, models.Visit.deleted_at.is_(None))
        .order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc())
        .first()
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/exam.html",
        {
            "patient": patient,
            "tests": [_serialize_lab_test(t, patient) for t in tests],
            "items_master": items_master,
            "item_by_code": item_by_code,
            "latest_visit": latest_visit,
            "lab_reference_range": fixtures.lab_reference_range,
            "banner": None,
        },
    )


@router.post("/animals/{karte_no}/exam", response_class=HTMLResponse)
async def exam_save(karte_no: str, request: Request, db: Session = Depends(get_db)):
    """検査保存。基準値は保存しない（`data/lab_items.json` から都度計算する）。"""
    patient = _patient_or_404(karte_no, db)
    form = await request.form()

    latest_visit = (
        db.query(models.Visit)
        .filter(models.Visit.patient_id == patient.id, models.Visit.deleted_at.is_(None))
        .order_by(models.Visit.visit_date.desc(), models.Visit.visit_no.desc())
        .first()
    )
    category = (form.get("category") or "").strip()
    tested_on_raw = (form.get("tested_on") or "").strip()

    banner: tuple[str, str] | None = None
    tested_on: dt.date | None = None
    if latest_visit is None:
        banner = ("error", "この動物にはまだ診察記録が無いため、検査を保存できません。")
    elif not category:
        banner = ("error", "検査カテゴリは必須です。")
    else:
        if tested_on_raw:
            try:
                tested_on = dt.date.fromisoformat(tested_on_raw)
            except ValueError:
                banner = ("error", "検査日の形式が正しくありません。")
        else:
            tested_on = dt.datetime.now(JST).date()

    if banner is None:
        items_master = fixtures.lab_items()
        rows: list[tuple[str, float | None, str | None]] = []
        for item in items_master:
            raw = (form.get(f"value_{item['item_code']}") or "").strip()
            if not raw:
                continue
            try:
                rows.append((item["item_code"], float(raw), None))
            except ValueError:
                rows.append((item["item_code"], None, raw))

        test = models.LabTest(
            patient_id=patient.id, visit_id=latest_visit.id, category=category,
            tested_on=tested_on, staff_id=_to_int(form.get("staff_id")),
        )
        db.add(test)
        db.flush()
        for code, value_num, value_text in rows:
            db.add(models.LabTestItem(
                lab_test_id=test.id, item_code=code, value_num=value_num, value_text=value_text,
            ))
        db.commit()
        banner = ("success", "保存しました。")

    tests = (
        db.query(models.LabTest)
        .filter(models.LabTest.patient_id == patient.id)
        .order_by(models.LabTest.tested_on.desc(), models.LabTest.id.desc())
        .all()
    )
    items_master = fixtures.lab_items()
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/exam.html",
        {
            "patient": patient,
            "tests": [_serialize_lab_test(t, patient) for t in tests],
            "items_master": items_master,
            "item_by_code": {i["item_code"]: i for i in items_master},
            "latest_visit": latest_visit,
            "lab_reference_range": fixtures.lab_reference_range,
            "banner": banner,
        },
    )


# ============================================================
# 画面 — 投薬
# ============================================================

@router.get("/animals/{karte_no}/dosing/{kind_id}", response_class=HTMLResponse)
def dosing_screen(
    karte_no: str, kind_id: str, request: Request,
    fiscal_year: int | None = None, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    rows = (
        db.query(models.Dosing)
        .filter(models.Dosing.patient_id == patient.id, models.Dosing.kind == kind_code)
        .order_by(models.Dosing.fiscal_year.desc())
        .all()
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/dosing.html",
        {
            "patient": patient, "kind_id": kind_id, "kind_name": _kind_name(kind_id),
            "rows": rows, "banner": None,
        },
    )


@router.post("/animals/{karte_no}/dosing/{kind_id}", response_class=HTMLResponse)
async def dosing_save(karte_no: str, kind_id: str, request: Request, db: Session = Depends(get_db)):
    """投薬の記録を保存（m01〜m12）。

    契約: 「送られなかった月」と「外した月」を混同しない。チェックボックスの
    有無ではこの3値を表現できない（未送信も未チェックも空欄になる）ため、
    月ごとに空／○／×の3択セレクトにしている（`coordination/qa/lane-d.md`）。
    """
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    form = await request.form()

    fiscal_year_raw = (form.get("fiscal_year") or "").strip()
    banner: tuple[str, str] | None = None

    if not fiscal_year_raw:
        banner = ("error", "年度を入力してください。新しい行は追加されません。")
    else:
        try:
            fiscal_year = int(fiscal_year_raw)
        except ValueError:
            banner = ("error", "年度の形式が正しくありません。")
        else:
            row = (
                db.query(models.Dosing)
                .filter(
                    models.Dosing.patient_id == patient.id,
                    models.Dosing.kind == kind_code,
                    models.Dosing.fiscal_year == fiscal_year,
                )
                .first()
            )
            if row is None:
                row = models.Dosing(patient_id=patient.id, kind=kind_code, fiscal_year=fiscal_year)
                db.add(row)

            bad_month = False
            for m in range(1, 13):
                key = f"m{m:02d}"
                if key not in form:
                    continue  # このフォームに含まれない＝この行の値は変えない
                val = (form.get(key) or "").strip()
                if val not in ("", "○", "×"):
                    bad_month = True
                    continue
                setattr(row, key, val)

            if bad_month:
                db.rollback()
                banner = ("error", "月の値は空・○・×のいずれかにしてください。")
            else:
                db.commit()
                banner = ("success", "保存しました。")

    rows = (
        db.query(models.Dosing)
        .filter(models.Dosing.patient_id == patient.id, models.Dosing.kind == kind_code)
        .order_by(models.Dosing.fiscal_year.desc())
        .all()
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/dosing.html",
        {
            "patient": patient, "kind_id": kind_id, "kind_name": _kind_name(kind_id),
            "rows": rows, "banner": banner,
        },
    )


# ============================================================
# 画面 — 予防
# ============================================================

@router.get("/animals/{karte_no}/prevention/{kind_id}", response_class=HTMLResponse)
def prevention_screen(
    karte_no: str, kind_id: str, request: Request,
    record_id: int | None = None, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    rows = (
        db.query(models.Prevention)
        .filter(models.Prevention.patient_id == patient.id, models.Prevention.kind == kind_code)
        .order_by(models.Prevention.performed_date.desc())
        .all()
    )
    edit_target = None
    if record_id is not None:
        edit_target = next((r for r in rows if r.id == record_id), None)
        if edit_target is None:
            raise ApiError("not_found")
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/prevention.html",
        {
            "patient": patient, "kind_id": kind_id, "kind_name": _kind_name(kind_id),
            "rows": rows, "edit_target": edit_target, "staff_by_id": staff_by_id, "banner": None,
        },
    )


@router.post("/animals/{karte_no}/prevention/{kind_id}", response_class=HTMLResponse)
async def prevention_save(karte_no: str, kind_id: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    form = await request.form()

    record_id_raw = (form.get("record_id") or "").strip()
    content = (form.get("content") or "").strip()
    performed_date_raw = (form.get("performed_date") or "").strip()
    next_due_raw = (form.get("next_due_date") or "").strip()
    staff_id = _to_int(form.get("staff_id"))

    banner: tuple[str, str] | None = None
    performed_date: dt.date | None = None
    next_due_date: dt.date | None = None

    if not performed_date_raw:
        banner = ("error", "実施日は必須です。")
    else:
        try:
            performed_date = dt.date.fromisoformat(performed_date_raw)
        except ValueError:
            banner = ("error", "実施日の形式が正しくありません。")

    if banner is None and next_due_raw:
        try:
            next_due_date = dt.date.fromisoformat(next_due_raw)
        except ValueError:
            banner = ("error", "次回予定日の形式が正しくありません。")
    # next_due_raw が空のときは next_due_date=None のまま保存する。
    # 基本周期は `data/masters.json` に列が無く全種別「未設定」扱い（D-14）のため、
    # 自動計算は行わない。

    if banner is None:
        if record_id_raw:
            row = db.get(models.Prevention, int(record_id_raw))
            if row is None or row.patient_id != patient.id or row.kind != kind_code:
                raise ApiError("not_found")
        else:
            row = models.Prevention(patient_id=patient.id, kind=kind_code)
            db.add(row)
        row.content = content
        row.performed_date = performed_date
        row.next_due_date = next_due_date
        row.staff_id = staff_id
        db.commit()
        banner = ("success", "保存しました。")

    rows = (
        db.query(models.Prevention)
        .filter(models.Prevention.patient_id == patient.id, models.Prevention.kind == kind_code)
        .order_by(models.Prevention.performed_date.desc())
        .all()
    )
    staff_by_id = {s.id: s.name for s in db.query(models.Staff).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/prevention.html",
        {
            "patient": patient, "kind_id": kind_id, "kind_name": _kind_name(kind_id),
            "rows": rows, "edit_target": None, "staff_by_id": staff_by_id, "banner": banner,
        },
    )


# ============================================================
# 画面 — 書類
# ============================================================

@router.get("/animals/{karte_no}/papers", response_class=HTMLResponse)
def papers_screen(karte_no: str, request: Request, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    papers = (
        db.query(models.Paper)
        .filter(models.Paper.patient_id == patient.id, models.Paper.removed_at.is_(None))
        .order_by(models.Paper.created_at.desc())
        .all()
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/papers.html", {"patient": patient, "papers": papers, "banner": None},
    )


@router.get("/papers/no-paper", response_class=HTMLResponse)
def papers_no_paper(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "clinical/papers_no_paper.html", {})


@router.get("/papers/{paper_id}", response_class=HTMLResponse)
def paper_detail(paper_id: int, request: Request, db: Session = Depends(get_db)):
    paper = db.get(models.Paper, paper_id)
    if paper is None:
        raise ApiError("not_found")
    patient = db.get(models.Patient, paper.patient_id)
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/paper_detail.html", {"paper": paper, "patient": patient},
    )


@router.post("/papers/{paper_id}/remove", response_class=HTMLResponse)
def paper_remove(paper_id: int, request: Request, db: Session = Depends(get_db)):
    """書類の取消。**論理削除**（`removed_at`）。`spec/screens.md` 13番「満たすべきこと」の
    「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」に従う
    （2026-09-06訂正。qa/lane-d.md D-18）。"""
    paper = db.get(models.Paper, paper_id)
    if paper is None:
        raise ApiError("not_found")
    patient = db.get(models.Patient, paper.patient_id)
    paper.removed_at = dt.datetime.now(JST)
    db.commit()

    papers = (
        db.query(models.Paper)
        .filter(models.Paper.patient_id == patient.id, models.Paper.removed_at.is_(None))
        .order_by(models.Paper.created_at.desc())
        .all()
        if patient is not None else []
    )
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "clinical/papers.html",
        {"patient": patient, "papers": papers, "banner": ("success", "削除しました。")},
    )


# ============================================================
# API — 投薬
# ============================================================

def _empty_dosing_dict(patient_id: int, kind_code: str, fiscal_year: int | None) -> dict:
    """裁定R-20: 記録が0件のときは404でも500でもなく200で空を返す。

    404でよいのは「患者そのものが存在しない」「種別が語彙に無い」ときだけ
    （どちらも `_patient_or_404` / `_kind_code_or_404` が先に弾く）。
    患者・種別は在るのに、その組み合わせの記録がまだ無いだけなら、資源が
    無いのではなく「まだ0件」なので404にしない（画面側は元から0件でも200）。
    """
    return {
        "id": None,
        "patient_id": patient_id,
        "kind": kind_code,
        "fiscal_year": fiscal_year if fiscal_year is not None else dt.datetime.now(JST).year,
        **{f"m{m:02d}": "" for m in range(1, 13)},
    }


@router.get("/api/patients/{karte_no}/dosing/{kind_id}")
def api_get_dosing(
    karte_no: str, kind_id: str, fiscal_year: int | None = None, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    q = db.query(models.Dosing).filter(
        models.Dosing.patient_id == patient.id, models.Dosing.kind == kind_code,
    )
    if fiscal_year is not None:
        row = q.filter(models.Dosing.fiscal_year == fiscal_year).first()
    else:
        row = q.order_by(models.Dosing.fiscal_year.desc()).first()
    if row is None:
        return _empty_dosing_dict(patient.id, kind_code, fiscal_year)
    return _dosing_dict(row)


class DosingUpdateBody(BaseModel):
    fiscal_year: int
    m01: str | None = None
    m02: str | None = None
    m03: str | None = None
    m04: str | None = None
    m05: str | None = None
    m06: str | None = None
    m07: str | None = None
    m08: str | None = None
    m09: str | None = None
    m10: str | None = None
    m11: str | None = None
    m12: str | None = None


@router.patch("/api/patients/{karte_no}/dosing/{kind_id}")
def api_update_dosing(
    karte_no: str, kind_id: str, body: DosingUpdateBody, db: Session = Depends(get_db),
):
    """投薬の月次記録を更新。対象の年度行が無ければ作る（他に更新経路が無いため）。"""
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    row = (
        db.query(models.Dosing)
        .filter(
            models.Dosing.patient_id == patient.id,
            models.Dosing.kind == kind_code,
            models.Dosing.fiscal_year == body.fiscal_year,
        )
        .first()
    )
    if row is None:
        row = models.Dosing(patient_id=patient.id, kind=kind_code, fiscal_year=body.fiscal_year)
        db.add(row)

    for m in range(1, 13):
        key = f"m{m:02d}"
        val = getattr(body, key)
        if val is None:
            continue
        if val not in ("", "○", "×"):
            raise ApiError(
                "invalid_input", [{"field": key, "message": "値は空・○・×のいずれかにしてください。"}],
            )
        setattr(row, key, val)

    db.commit()
    db.refresh(row)
    return _dosing_dict(row)


# ============================================================
# API — 予防
# ============================================================

@router.get("/api/patients/{karte_no}/prevention/{kind_id}")
def api_list_prevention(karte_no: str, kind_id: str, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    rows = (
        db.query(models.Prevention)
        .filter(models.Prevention.patient_id == patient.id, models.Prevention.kind == kind_code)
        .order_by(models.Prevention.performed_date.desc())
        .all()
    )
    return {"items": [_prevention_dict(r) for r in rows], "total": len(rows)}


class PreventionCreateBody(BaseModel):
    content: str | None = None
    performed_date: dt.date
    next_due_date: dt.date | None = None
    staff_id: int | None = None


@router.post("/api/patients/{karte_no}/prevention/{kind_id}", status_code=201)
def api_create_prevention(
    karte_no: str, kind_id: str, body: PreventionCreateBody, db: Session = Depends(get_db),
):
    patient = _patient_or_404(karte_no, db)
    kind_code = _kind_code_or_404(kind_id)
    row = models.Prevention(
        patient_id=patient.id, kind=kind_code, content=body.content or "",
        performed_date=body.performed_date, next_due_date=body.next_due_date,
        staff_id=body.staff_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _prevention_dict(row)


# ============================================================
# API — 書類
# ============================================================

@router.get("/api/patients/{karte_no}/papers")
def api_list_papers(karte_no: str, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    rows = (
        db.query(models.Paper)
        .filter(models.Paper.patient_id == patient.id, models.Paper.removed_at.is_(None))
        .order_by(models.Paper.created_at.desc())
        .all()
    )
    return {"items": [_paper_dict(r) for r in rows], "total": len(rows)}


class PaperCreateBody(BaseModel):
    title: str
    note: str | None = None


@router.post("/api/patients/{karte_no}/papers", status_code=201)
def api_create_paper(karte_no: str, body: PaperCreateBody, db: Session = Depends(get_db)):
    patient = _patient_or_404(karte_no, db)
    if not body.title.strip():
        raise ApiError("invalid_input", [{"field": "title", "message": "タイトルは必須です。"}])
    row = models.Paper(
        patient_id=patient.id, title=body.title.strip(), note=body.note,
        created_at=dt.datetime.now(JST),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _paper_dict(row)


@router.get("/api/papers/{paper_id}")
def api_get_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.get(models.Paper, paper_id)
    if paper is None:
        raise ApiError("not_found")
    return _paper_dict(paper)


@router.delete("/api/papers/{paper_id}")
def api_delete_paper(paper_id: int, db: Session = Depends(get_db)):
    """論理削除（`models.Paper.removed_at`）。`spec/screens.md` 13番「満たすべきこと」の
    「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」に従う
    （2026-09-06訂正。以前は物理削除にしていた——qa/lane-d.md D-18）。"""
    paper = db.get(models.Paper, paper_id)
    if paper is None:
        raise ApiError("not_found")
    paper.removed_at = dt.datetime.now(JST)
    db.commit()
    db.refresh(paper)
    return _paper_dict(paper)
