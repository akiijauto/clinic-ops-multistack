"""設定。環境変数だけを入口にする。

なぜ環境変数に寄せるか: 共通テスト（リポジトリ直下の `tests/`）は HTTP 越しに叩く。
テストが使うDBと開発用のDBを分けたいが、**テスト側にPythonの都合を持ち込めない**
（judge は言語に依存しない）。だから外から差し替えられる形にしておく。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

# 業務の時刻はすべてこれで扱う（spec/README.md「日付・時刻は JST。集計の月境界も JST」）。
# datetime.now() を素で呼ばないこと。呼ぶと動かす機械のタイムゾーンに引きずられる。
JST = ZoneInfo("Asia/Tokyo")

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
