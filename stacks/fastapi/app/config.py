"""設定。環境変数だけを入口にする。

なぜ環境変数に寄せるか: 共通テスト（リポジトリ直下の `tests/`）は HTTP 越しに叩く。
テストが使うDBと開発用のDBを分けたいが、**テスト側にPythonの都合を持ち込めない**
（judge は言語に依存しない）。だから外から差し替えられる形にしておく。
"""

from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

# 業務の時刻はすべてこれで扱う（spec/README.md「日付・時刻は JST。集計の月境界も JST」）。
# datetime.now() を素で呼ばないこと。呼ぶと動かす機械のタイムゾーンに引きずられる。
JST = ZoneInfo("Asia/Tokyo")


def jst_isoformat(value: dt.datetime) -> str:
    """DateTime(timezone=True) 列をJSON化するとき、これを通してから `isoformat()` する。

    2026-09-06、監査役の指摘（`POST /api/reservations` の500、
    `coordination/qa/lane-d.md` D-24）を追った際に見つけた副産物: SQLiteは
    `DateTime(timezone=True)` でも実際にはtzinfoを保持しない。書き込み時は
    `+09:00` 付きの値を渡しても、読み戻すとnaiveに戻る。**無印のまま
    `isoformat()` すると、レスポンスのタイムゾーンがどこかを読み手が判断できない**
    （実害は無くても契約の `format: date-time` の意図には合わない）。
    値は業務上すべてJSTで扱っているので、naiveならJSTと見なして付け直す。
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=JST).isoformat()
    return value.astimezone(JST).isoformat()

BASE_DIR = Path(__file__).resolve().parent
STACK_DIR = BASE_DIR.parent


@dataclass(frozen=True, slots=True)
class Settings:
    db_url: str
    templates_dir: Path
    static_dir: Path

    @classmethod
    def from_env(cls) -> "Settings":
        db_url = os.environ.get("CLINIC_DB_URL")
        if not db_url:
            data_dir = STACK_DIR / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            db_url = f"sqlite+pysqlite:///{data_dir / 'clinic.db'}"
        return cls(
            db_url=db_url,
            templates_dir=BASE_DIR / "templates",
            static_dir=BASE_DIR / "static",
        )


def get_settings() -> Settings:
    """毎回読み直す。プロセス内でキャッシュしない。

    キャッシュすると、テストが `CLINIC_DB_URL` を差し替えても効かない。
    起動時に1回しか読まない作りは、その事故が**静かに**起きる。
    """
    return Settings.from_env()
