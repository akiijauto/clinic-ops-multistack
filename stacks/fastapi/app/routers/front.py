"""ナビの残り（本日の患者・検索・DM・売上集計・スタッフ・設定・このシステムについて）。

いまは検算8（死んだリンクが無い）を通すための**表示のみ**の実装。
保存系（設定の編集・受付の並べ替え等）は次段階。それぞれ真のDBの値を読む
（ダミーの固定文言を並べただけの画面にしない——検算3と同じ理由）。
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
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

    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/today.html",
        {
            "receptions": receptions,
            "visit_count_today": visit_count_today,
            "patient_by_id": patient_by_id,
            "owner_by_id": owner_by_id,
        },
    )


@router.get("/search", response_class=HTMLResponse)
def search_screen(request: Request, q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Patient).filter(models.Patient.deleted_at.is_(None))
    if q:
        like = f"%{q}%"
        query = query.filter(
            (models.Patient.name_kanji.like(like))
            | (models.Patient.name_kana.like(like))
            | (models.Patient.karte_no.like(like))
        )
    patients = query.order_by(models.Patient.karte_no).limit(50).all()
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/search.html", {"patients": patients, "q": q or ""})


@router.get("/dm", response_class=HTMLResponse)
def dm_screen(request: Request, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Prevention)
        .filter(models.Prevention.next_due_date.is_not(None))
        .order_by(models.Prevention.next_due_date)
        .limit(100)
        .all()
    )
    patient_by_id = {p.id: p for p in db.query(models.Patient).all()}
    owner_by_id = {o.id: o for o in db.query(models.Owner).all()}
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "front/dm.html",
        {"rows": rows, "patient_by_id": patient_by_id, "owner_by_id": owner_by_id},
    )


@router.get("/sales", response_class=HTMLResponse)
def sales_screen(request: Request, db: Session = Depends(get_db)):
    summary = compute_summary(db)
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/sales.html", {"summary": summary})


@router.get("/staff", response_class=HTMLResponse)
def staff_screen(request: Request, db: Session = Depends(get_db)):
    rows = db.query(models.Staff).filter(models.Staff.is_active.is_(True)).order_by(models.Staff.staff_code).all()
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/staff.html", {"staff": rows})


@router.get("/settings", response_class=HTMLResponse)
def settings_screen(request: Request, db: Session = Depends(get_db)):
    clinic = db.query(models.Clinic).first()
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/settings.html", {"clinic": clinic})


@router.get("/about", response_class=HTMLResponse)
def about_screen(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "front/about.html", {})
