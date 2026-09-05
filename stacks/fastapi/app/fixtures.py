"""固定データ（`data/`）の読み込み。

**画面から編集しない**（`spec/model.md`）。読み込むだけ。

`data/lab_items.json` / `data/price_items.json` / `data/masters.json` は
プロセスの寿命ぶんメモリに載せておく（DBに複製しない）。理由は2つ:

1. 契約が「一覧と参照は作る。編集は作らない」と決めている固定データを
   書き込み可能なテーブルに置くと、うっかり書ける経路ができてしまう
2. `data/make_data.py` を再実行して中身が変わったとき、**プロセスを再起動するだけ**で
   最新の内容に揃う。DBへ複製すると、複製し直す手順が要る
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# stacks/fastapi/app/fixtures.py から見て ../../../data
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


def _load(name: str) -> Any:
    path = DATA_DIR / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def lab_items() -> list[dict]:
    return _load("lab_items.json")


@lru_cache(maxsize=1)
def price_items() -> list[dict]:
    return _load("price_items.json")


@lru_cache(maxsize=1)
def masters() -> dict:
    return _load("masters.json")


@lru_cache(maxsize=1)
def seed() -> dict:
    """`data/seed.json`。DB投入にも、投入せず直接参照する用途にも両方使う。"""
    return _load("seed.json")


def price_item_by_code(code: str) -> dict | None:
    for item in price_items():
        if item.get("price_code") == code:
            return item
    return None


def lab_reference_range(item_code: str, species: str, sex: str) -> dict | None:
    """検査項目の基準値を species / sex で引く。戻り値は `low` / `high` を持つ辞書。

    `spec/model.md`: 「species(dog/cat/other) と sex(male/female/any) で範囲が変わる」。
    dog/cat 以外の種別は other 扱い、unknown の性別は any 扱いにする
    （`data/README.md` に明記された規則）。実測（2026-09-05）:
    `data/lab_items.json` の `reference_ranges` は `low` / `high` というキー名で、
    `min` / `max` ではない（`acceptance.md` の説明文はあくまで概念上の呼び名）。

    項目によっては sex が男女別に分かれている場合と `any` だけの場合がある。
    **性別ぴったりの定義があればそれを優先し、無ければ `any` にフォールバックする。**
    """
    item = next((i for i in lab_items() if i.get("item_code") == item_code), None)
    if item is None:
        return None

    norm_species = species if species in ("dog", "cat") else "other"
    norm_sex = sex if sex in ("male", "female") else "any"

    ranges = item.get("reference_ranges", [])
    exact = next(
        (rr for rr in ranges if rr.get("species") == norm_species and rr.get("sex") == norm_sex),
        None,
    )
    if exact is not None:
        return exact
    return next(
        (rr for rr in ranges if rr.get("species") == norm_species and rr.get("sex") == "any"),
        None,
    )
