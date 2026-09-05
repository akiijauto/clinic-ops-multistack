"""レーンD自身のテストの下ごしらえ。

**これは完了の判定ではない。** 完了はリポジトリ直下の共通テスト（`tests/`）が緑に
なったときだけで、ここが緑でも「終わった」とは言えない（`briefs/lane-d.md`）。
ここは実装しながら手元で確かめるためのもの。
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    """1テスト1DB。テスト同士が同じDBを共有すると、落ちる原因が入れ替わる。"""
    monkeypatch.setenv("CLINIC_DB_URL", f"sqlite+pysqlite:///{tmp_path / 'test.db'}")

    from app import db as db_module

    db_module.reset_engine()

    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c

    db_module.reset_engine()
