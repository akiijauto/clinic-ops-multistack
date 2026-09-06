"""ナビの残り（本日の患者・検索・DM・売上集計・スタッフ・設定・このシステムについて）。

検算8（死んだリンクが無い）を通すための表示のみの実装から、設定の保存を追加した
（2026-09-06 続き）。それぞれ真のDBの値を読む（ダミーの固定文言を並べただけの
画面にしない——検算3と同じ理由）。
"""

from __future__ import annotations

import csv
import datetime as dt
import io

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app import models
from app.config import JST
from app.db import get_db
from app.routers.sales import compute_summary

router = APIRouter(tags=["screens-front"])


def _today_jst() -> dt.date:
    return dt.datetime.now(JST).date()


@router.get("/", response_class=HTMLResponse)
@router.get("/today", response_class=HTMLResponse)
def today_screen(request: Request, db: Session = Depends(get_db)):
    today = _today_jst()
    start = dt.datetime.combine(today, dt.time.min, tzinfo=JST)
    end = start + dt.timedelta(days=1)

    receptions = (
        db.query(models.Reception)
        .filter(models.Reception.received_at >= start, models.Reception.received_at < end)
        .order_by(models.Reception.display_no)
        .all()
    )
    visit_count_today = (
        db.query(models.Visit)
        .filter(models.Visit.visit_date == today, models.Visit.deleted_at.is_(None))
        .count()
    )
    patient_by_id = {p.id: p for p in db.query(models.Patient).all()}
    owner_by_id = {o.id: o for o in db.query(models.Owner).all()}

    # `/` は screen-top、`/today` は screen-today（同じ画面だが目印は契約でパスごとに
    # 違う。2026-09-06、指揮役の新規在庫検査で気づいた——data-testid実装時に対応）。
    screen_key = "top" if request.url.path == "/" else "today"

    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/today.html",
        {
            "receptions": receptions,
            "visit_count_today": visit_count_today,
            "patient_by_id": patient_by_id,
            "owner_by_id": owner_by_id,
            "screen_key": screen_key,
        },
    )


_VISIT_SEARCH_FIELDS = [
    ("chief_complaint", "主訴"), ("symptom", "症状"), ("diagnosis", "診断"), ("treatment", "処置"),
]


def _excerpt(text: str, q: str, radius: int = 15) -> str:
    """当たった前後の文字を出す（`spec/screens.md` 4番）。"""
    idx = text.find(q)
    if idx < 0:
        return text[: radius * 2]
    start = max(0, idx - radius)
    end = min(len(text), idx + len(q) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end]}{suffix}"


@router.get("/search", response_class=HTMLResponse)
def search_screen(request: Request, q: str | None = None, db: Session = Depends(get_db)):
    """検索。`spec/screens.md` 4番:
    - 「飼主・動物」（`Owner`/`Patient` を氏名・カナ・カルテNo・電話番号で検索）
    - 「診察の中身」（`Visit` の主訴・症状・診断・処置を全文検索、当たった欄と前後を出す）
    2つは独立（片方0件でももう片方は出す）。`q` が空のときはどちらも出さない
    （案内文だけ）。`deleted_at` の入った Owner/Patient/Visit は既定で対象外。
    """
    patients: list[models.Patient] = []
    visit_hits: list[dict] = []

    if q:
        like = f"%{q}%"
        patients = (
            db.query(models.Patient)
            .join(models.Owner, models.Patient.owner_id == models.Owner.id)
            .filter(
                models.Patient.deleted_at.is_(None),
                models.Owner.deleted_at.is_(None),
                (models.Patient.name_kanji.like(like))
                | (models.Patient.name_kana.like(like))
                | (models.Patient.karte_no.like(like))
                | (models.Owner.name_kanji.like(like))
                | (models.Owner.name_kana.like(like))
                | (models.Owner.phone.like(like))
                | (models.Owner.mobile.like(like)),
            )
            .order_by(models.Patient.karte_no)
            .limit(50)
            .all()
        )

        visit_filter = None
        for col, _label in _VISIT_SEARCH_FIELDS:
            cond = getattr(models.Visit, col).like(like)
            visit_filter = cond if visit_filter is None else (visit_filter | cond)
        visits = (
            db.query(models.Visit)
            .join(models.Patient, models.Visit.patient_id == models.Patient.id)
            .filter(models.Visit.deleted_at.is_(None), models.Patient.deleted_at.is_(None), visit_filter)
            .order_by(models.Visit.visit_date.desc())
            .limit(50)
            .all()
        )
        patient_by_id = {p.id: p for p in db.query(models.Patient).all()}
        for v in visits:
            p = patient_by_id.get(v.patient_id)
            for col, label in _VISIT_SEARCH_FIELDS:
                value = getattr(v, col) or ""
                if q in value:
                    visit_hits.append({
                        "visit": v, "patient": p, "field_label": label,
                        "excerpt": _excerpt(value, q),
                    })

    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/search.html",
        {"patients": patients, "visit_hits": visit_hits, "q": q or ""},
    )


def _dm_rows(db: Session) -> list[models.Prevention]:
    """`/dm`・`/dm.csv` が共有する絞り込み。**2つで書き写すと片方だけ直し忘れる**
    （`sales.py` の `compute_summary` と同じ考え方）。

    契約（openapi.yaml）は `type`/`field`/`span`/`from`/`to` のクエリを定義しているが、
    元の画面実装がこれらを使っていなかった（2026-09-06、`/dm.csv` 追加時に気づいた
    既存の未対応——今回はCSVとHTMLを同じ絞り込みに揃えることを優先し、
    クエリでの追加絞り込み自体は次段階に送る）。
    """
    return (
        db.query(models.Prevention)
        .filter(models.Prevention.next_due_date.is_not(None))
        .order_by(models.Prevention.next_due_date)
        .limit(100)
        .all()
    )


@router.get("/dm", response_class=HTMLResponse)
def dm_screen(request: Request, db: Session = Depends(get_db)):
    rows = _dm_rows(db)
    patient_by_id = {p.id: p for p in db.query(models.Patient).all()}
    owner_by_id = {o.id: o for o in db.query(models.Owner).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/dm.html",
        {"rows": rows, "patient_by_id": patient_by_id, "owner_by_id": owner_by_id},
    )


@router.get("/dm.csv")
def dm_csv(db: Session = Depends(get_db)):
    """DM一覧のCSV書き出し。`/dm` と同じ絞り込み・同じ並び（`_dm_rows` を共有）。"""
    rows = _dm_rows(db)
    patient_by_id = {p.id: p for p in db.query(models.Patient).all()}
    owner_by_id = {o.id: o for o in db.query(models.Owner).all()}

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["karte_no", "owner_name_kanji", "patient_name_kanji", "kind", "next_due_date", "performed_date"])
    for r in rows:
        patient = patient_by_id.get(r.patient_id)
        owner = owner_by_id.get(patient.owner_id) if patient else None
        writer.writerow([
            patient.karte_no if patient else "",
            owner.name_kanji if owner else "",
            patient.name_kanji if patient else "",
            r.kind,
            r.next_due_date.isoformat() if r.next_due_date else "",
            r.performed_date.isoformat() if r.performed_date else "",
        ])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv")


@router.get("/sales", response_class=HTMLResponse)
def sales_screen(request: Request, db: Session = Depends(get_db)):
    summary = compute_summary(db)
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/sales.html", {"summary": summary})


_CURRENT_STAFF_COOKIE = "current_staff_id"


def _current_staff(request: Request, db: Session) -> models.Staff | None:
    raw = request.cookies.get(_CURRENT_STAFF_COOKIE)
    if not raw or not raw.isdigit():
        return None
    return db.get(models.Staff, int(raw))


@router.get("/staff", response_class=HTMLResponse)
def staff_screen(request: Request, db: Session = Depends(get_db)):
    rows = db.query(models.Staff).filter(models.Staff.is_active.is_(True)).order_by(models.Staff.staff_code).all()
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/staff.html", {"staff": rows, "current_staff": _current_staff(request, db)},
    )


@router.post("/staff", response_class=HTMLResponse)
def staff_select(
    request: Request, db: Session = Depends(get_db),
    action: str = Form(...), staff_id: int | None = Form(None),
):
    """担当選択（`spec/screens.md` 21番）。**認証ではない**——パスワードは扱わない。

    選択は認証ではないので Cookie で十分（`spec/README.md`「他の画面の閲覧・保存は
    妨げられない」——未選択でも他画面は普通に使える設計と合う）。契約に
    `POST /staff` の定義は無いが、`/settings` 同様「同じ画面パスへ保存フォームを足す」
    前例に倣った（`coordination/qa/lane-d.md` D-25、レーンR 5巡目の指摘への対応）。
    """
    rows = db.query(models.Staff).filter(models.Staff.is_active.is_(True)).order_by(models.Staff.staff_code).all()
    templates = request.app.state.templates

    if action == "clear":
        response = templates.TemplateResponse(
            request, "front/staff.html", {"staff": rows, "current_staff": None},
        )
        response.delete_cookie(_CURRENT_STAFF_COOKIE)
        return response

    selected = db.get(models.Staff, staff_id) if staff_id else None
    resp = templates.TemplateResponse(
        request, "front/staff.html", {"staff": rows, "current_staff": selected},
    )
    if selected is not None:
        resp.set_cookie(_CURRENT_STAFF_COOKIE, str(selected.id), max_age=60 * 60 * 24 * 30)
    return resp


@router.get("/settings", response_class=HTMLResponse)
def settings_screen(request: Request, db: Session = Depends(get_db)):
    clinic = db.query(models.Clinic).first()
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/settings.html", {"clinic": clinic, "banner": None})


@router.post("/settings", response_class=HTMLResponse)
def settings_save(
    request: Request,
    db: Session = Depends(get_db),
    name: str = Form(""),
    postal_code: str = Form(""),
    address1: str = Form(""),
    address2: str = Form(""),
    phone: str = Form(""),
    fax: str = Form(""),
    director_name: str = Form(""),
    reservation_slot_minutes: int = Form(15),
    tax_rate: float = Form(0.10),
    closed_weekdays: list[str] = Form([]),
):
    """`Clinic` は常に1件のみ（`spec/screens.md` 22番）。新規作成はしない。

    契約: 「保存の成否によらず200。」保存に失敗しても画面を200で再描画し、
    打った値と一緒にエラー文言を出す（`spec/openapi.yaml` 冒頭の説明どおり）。
    """
    clinic = db.query(models.Clinic).first()
    templates = request.app.state.templates

    if clinic is None:
        return templates.TemplateResponse(
            request, "front/settings.html",
            {"clinic": None, "banner": ("error", "病院情報が見つかりません。")},
        )

    try:
        weekdays = sorted({int(d) for d in closed_weekdays if d != ""})
    except ValueError:
        return templates.TemplateResponse(
            request, "front/settings.html",
            {"clinic": clinic, "banner": ("error", "休診日の指定が不正です。")},
        )

    clinic.name = name
    clinic.postal_code = postal_code
    clinic.address1 = address1
    clinic.address2 = address2
    clinic.phone = phone
    clinic.fax = fax
    clinic.director_name = director_name
    clinic.reservation_slot_minutes = reservation_slot_minutes
    clinic.tax_rate = tax_rate
    clinic.closed_weekdays = weekdays
    db.commit()

    return templates.TemplateResponse(
        request, "front/settings.html",
        {"clinic": clinic, "banner": ("success", "保存しました。")},
    )


@router.get("/about", response_class=HTMLResponse)
def about_screen(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/about.html", {})
