"""FastAPI アプリの組み立て。

**統合点はレーンD本体が書く**（`coordination/briefs/lane-d.md`）。
領域ごとのサブエージェントが書くのは `app/routers/` と `app/templates/` の
自分の領域だけで、ここに並ぶ `include_router` の順序と前提はレーン本体が持つ。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import db as db_module
from app import models  # noqa: F401  metadata に全テーブルを登録するために読み込む
from app.config import get_settings
from app.errors import register_error_handlers
from app.routers import billing, front, health, karte, lab, reservations, sales, ward
from app.seed_loader import load_seed

# 領域ごとのルーターは契約が凍ってからここへ足す。
# 1 受付・患者 / 2 診療 / 3 会計・売上 / 4 入院・予約・業務 / 5 設定
# money 組（検算1・2）に要る分だけ、会計と売上集計を先に足した（2026-09-05）。
# screen 組（検算3・4・5）に要る分だけ、カルテと検査を足した（2026-09-05）。
# rules・crawl 組（検算6・7・8）に要る分だけ、予約・入院・ナビ残りの画面を足した
# （2026-09-06）。


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    # テーブル作成とseed投入。**空のときだけ**投入する（seed_loader.is_seeded）。
    # テストは1テスト1DBで動くので、この処理が毎回走っても実害は無い。
    db_module.Base.metadata.create_all(db_module.get_engine())
    factory = db_module.get_session_factory()
    with factory() as session:
        load_seed(session)
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="動物病院 窓口業務システム — FastAPI 実装",
        description="学習・研究目的の実装。レーンD（Python / FastAPI）。",
        version="0.1.0",
        lifespan=_lifespan,
    )

    settings.static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

    # テンプレートは app.state に載せる。各領域のルーターはここから取る。
    # モジュール読み込み時に作らないのは、テストが差し替えられなくなるため。
    app.state.templates = Jinja2Templates(directory=str(settings.templates_dir))

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(billing.router)
    app.include_router(sales.router)
    app.include_router(karte.router)
    app.include_router(lab.router)
    app.include_router(reservations.router)
    app.include_router(ward.router)
    app.include_router(front.router)

    return app


app = create_app()
