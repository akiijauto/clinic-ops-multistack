"""土台の見張り。**契約に依存しない**ことだけを確かめる。

ここに画面のテストは書かない。完了の判定は共通テスト（リポジトリ直下の `tests/`）。
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.config import JST, get_settings


def test_jst_is_resolvable_and_is_plus_9():
    """JST が引けること。

    Windows には OS のタイムゾーンDBが無いので、`tzdata` を入れないと
    `ZoneInfoNotFoundError` で落ちる。2026-09-05 に実際に落ちた。
    契約は「日付・時刻は JST。集計の月境界も JST」なので、ここが死ぬと
    **集計だけが静かにずれる**（例外は出るが、出る場所が集計の実装まで遅れる）。
    """
    offset = datetime(2026, 9, 5, 12, 0, tzinfo=JST).utcoffset()
    assert offset == timedelta(hours=9)


def test_jst_has_no_dst():
    """日本には夏時間が無い。1月でも8月でも +09:00 のままであること。"""
    winter = datetime(2026, 1, 15, 12, 0, tzinfo=JST).utcoffset()
    summer = datetime(2026, 8, 15, 12, 0, tzinfo=JST).utcoffset()
    assert winter == summer == timedelta(hours=9)


def test_settings_are_reread_each_call(tmp_path, monkeypatch):
    """設定をキャッシュしないこと。

    キャッシュすると、テストが `CLINIC_DB_URL` を差し替えても効かず、
    **本物のDBを踏んだまま緑になる**。
    """
    # カレントディレクトリに置かない。置くと、キャッシュを壊した実験のときに
    # 実際に a.db がリポジトリへ落ちた（2026-09-05）。テストが痕跡を残さないようにする。
    monkeypatch.setenv("CLINIC_DB_URL", f"sqlite+pysqlite:///{tmp_path / 'a.db'}")
    first = get_settings().db_url
    monkeypatch.setenv("CLINIC_DB_URL", f"sqlite+pysqlite:///{tmp_path / 'b.db'}")
    second = get_settings().db_url
    assert first != second


def test_sqlite_foreign_keys_are_on(tmp_path, monkeypatch):
    """SQLite の外部キー制約が効いていること。

    SQLite は既定で外部キーを見ない。切れていると、壊れた参照を持つ行が
    エラー無しで保存できてしまう。
    """
    monkeypatch.setenv("CLINIC_DB_URL", f"sqlite+pysqlite:///{tmp_path / 'fk.db'}")

    from sqlalchemy import text

    from app import db as db_module

    db_module.reset_engine()
    try:
        with db_module.get_engine().connect() as conn:
            assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
    finally:
        db_module.reset_engine()
