"""DBの土台。SQLite + SQLAlchemy 2.0。

DBの選択は各レーンの自由（`coordination/DECISIONS.md` 4節）。追加インストールが
要らないものに限るという条件があり、SQLite が推奨されているのでそれに従う。

**モデルはまだ置かない。** 契約（`spec/model.md`）が凍っていないため、
いま形を決めると凍った契約と食い違って作り直しになる。ここは土台だけ。
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """全モデルの親。具体的なモデルは契約が凍ってから `app/models/` に置く。"""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_connection, connection_record) -> None:
    """SQLite の外部キー制約を有効にする。

    SQLite は**既定で外部キーを見ない**。有効にしないと、存在しない飼主IDを持つ動物を
    保存できてしまい、しかもエラーは出ない。「保存できた」と「正しく保存できた」は別。
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        connect_args = {}
        if settings.db_url.startswith("sqlite"):
            # FastAPI は複数スレッドから触るので、SQLite の同一スレッド検査を外す。
            connect_args["check_same_thread"] = False
        _engine = create_engine(settings.db_url, connect_args=connect_args, future=True)
        _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _session_factory is not None
    return _session_factory


def reset_engine() -> None:
    """接続を捨てる。テストがDBを差し替えるときに使う。"""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


def get_db() -> Iterator[Session]:
    """FastAPI の依存。1リクエスト1セッション。"""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
    finally:
        session.close()
