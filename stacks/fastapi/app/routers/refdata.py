"""ToDo・折りたたみ表示・機能設定・マスタ・取込。

**参照専用の5画面をまとめた1ファイル。** どれも「読むだけ」で、書き込み経路を持たない
（マスタ・取込は `spec/README.md`「一覧と参照は作る。編集は作らない」の対象）。
唯一の例外は `/settings/import`（POST）で、それも**保存はせず列名と件数を読むだけ**
（契約どおり）。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session

from app import feature_notes, fixtures, models
from app.db import get_db
from app.errors import ApiError

router = APIRouter()

MASTER_KEYS = ["price_item", "lab_item", "reception_kind", "prevention_kind", "department", "phrase"]


def _master_rows(key: str) -> list[dict]:
    if key == "price_item":
        return fixtures.price_items()
    if key == "lab_item":
        return fixtures.lab_items()
    m = fixtures.masters()
    mapping = {
        "reception_kind": "reception_kinds",
        "prevention_kind": "prevention_kinds",
        "department": "departments",
        "phrase": "phrases",
    }
    if key in mapping:
        return m.get(mapping[key], [])
    raise ApiError("not_found")


# ── ToDo（C状態: あえて動かさない） ─────────────────────

@router.get("/todo/{key}", response_class=HTMLResponse, tags=["screens-ops"])
def todo_screen(key: str, request: Request):
    note = feature_notes.get(key)
    if note is None or note.kind != "todo":
        raise ApiError("not_found")
    templates = request.app.state.templates
    return templates.TemplateResponse(request, "refdata/todo.html", {"note": note})


@router.get("/api/todo/{key}", tags=["api-misc"])
def api_todo(key: str):
    note = feature_notes.get(key)
    if note is None or note.kind != "todo":
        raise ApiError("not_found")
    return {"key": note.key, "kind": note.kind, "title": note.title, "message": note.message}


# ── 折りたたみ表示（B状態: この企画では作っていない） ───────────

@router.get("/folded/{key}", response_class=HTMLResponse, tags=["screens-reception"])
def folded_screen(key: str, request: Request):
    """`key` が既知の折りたたみ項目ならそこへスクロールする体で個別に返し、
    未知（一覧を求めているだけ）でも一覧全体は必ず出す。
    """
    note = feature_notes.get(key) if key != "_all" else None
    if key != "_all" and (note is None or note.kind != "folded"):
        raise ApiError("not_found")
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "refdata/folded.html",
        {"notes": feature_notes.FOLDED_NOTES, "highlight_key": key if note else None},
    )


# ── 機能設定（screens-settings 23番） ─────────────────────

@router.get("/settings/features", response_class=HTMLResponse, tags=["screens-settings"])
def settings_features_screen(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "refdata/settings_features.html",
        {"folded": feature_notes.FOLDED_NOTES, "todos": feature_notes.TODO_NOTES},
    )


@router.get("/api/features", tags=["api-misc"])
def api_features():
    return {
        "items": [
            {"key": n.key, "kind": n.kind, "title": n.title, "message": n.message}
            for n in feature_notes.ALL_NOTES
        ]
    }


# ── マスタ（参照専用。編集フォームなし） ─────────────────────

@router.get("/settings/master", response_class=HTMLResponse, tags=["screens-settings"])
def settings_master_default(request: Request):
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "refdata/master.html",
        {"key": MASTER_KEYS[0], "keys": MASTER_KEYS, "rows": _master_rows(MASTER_KEYS[0])},
    )


@router.get("/settings/master/{key}", response_class=HTMLResponse, tags=["screens-settings"])
def settings_master(key: str, request: Request):
    rows = _master_rows(key)  # 未知キーは ApiError("not_found") → 404
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "refdata/master.html", {"key": key, "keys": MASTER_KEYS, "rows": rows},
    )


@router.get("/api/masters/{key}", tags=["api-masters"])
def api_master(key: str, limit: int = 100, offset: int = 0):
    rows = _master_rows(key)
    page = rows[offset:offset + limit]
    return {"key": key, "items": page, "total": len(rows)}


# ── 取込（screens-settings 24番） ─────────────────────

def _seed_counts(db: Session) -> dict[str, int]:
    return {
        "owners": db.query(models.Owner).count(),
        "patients": db.query(models.Patient).count(),
        "visits": db.query(models.Visit).count(),
        "billings": db.query(models.Billing).count(),
        "reservations": db.query(models.Reservation).count(),
        "hospitalizations": db.query(models.Hospitalization).count(),
    }


@router.get("/settings/import", response_class=HTMLResponse, tags=["screens-settings"])
def settings_import_screen(request: Request, db: Session = Depends(get_db)):
    templates = request.app.state.templates
    return templates.TemplateResponse(
        request, "refdata/import.html", {"counts": _seed_counts(db), "survey": None},
    )


@router.post("/settings/import", response_class=HTMLResponse, tags=["screens-settings"])
async def settings_import_survey(
    request: Request, file: UploadFile, db: Session = Depends(get_db),
):
    """CSVの列名と件数だけを読む。**保存はしない**（契約どおり）。"""
    templates = request.app.state.templates
    try:
        raw = await file.read()
        text = raw.decode("utf-8-sig")
        lines = [ln for ln in text.splitlines() if ln.strip() != ""]
        header = lines[0].split(",") if lines else []
        survey = {"filename": file.filename, "columns": header, "row_count": max(len(lines) - 1, 0)}
        banner = ("success", f"{file.filename} を読み取りました（保存はしていません）。")
    except (UnicodeDecodeError, ValueError):
        survey = None
        banner = ("error", "ファイルを読み取れませんでした。CSV形式を確認してください。")

    return templates.TemplateResponse(
        request, "refdata/import.html",
        {"counts": _seed_counts(db), "survey": survey, "banner": banner},
    )
