"""在庫検査 — 契約に載っている画面とAPIが、実装に「在る」かを数える。

**なぜ要るか（2026-09-06 の事故）**

共通テスト14件が5実装すべて緑・食い違い0になったのを見て、指揮役が「完了」と
判断して push した。実際にはレーンDが「未完了。残り23画面・26 API」と報告していた。

原因は判定側の穴である。検算8のクローラーは**辿り着けたリンクが生きているか**しか
見ない。まだ作っていない画面はリンクが張られていないので、**クローラーからは
最初から存在しない**。つまり **作っていないほど緑になる**。

だからこの検査はクロールをしない。`spec/openapi.yaml` に書いてあるパスを
**1件ずつ直に叩く**。リンクの有無と無関係に、在るか無いかだけを見る。

    「検算が緑」と「作り終えた」は別のこと。

run.py から register() 経由で読み込まれる。`--only inventory` で単独実行できる。
"""
from __future__ import annotations

import os
import re

_SPEC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "spec", "openapi.yaml")

# 画面として叩いても意味が無いもの（CSV配信・死活・外部照会）
_NOT_SCREEN = {"/healthz", "/postal", "/dm.csv"}

# パス変数に入れる実在の値。data/ の中身に合わせてある。
_SAMPLE = {"karte_no": "10002", "visit_id": "1", "kind_id": "1",
           "paper_id": "1", "id": "1", "key": "reception"}


def _spec_paths() -> list[str]:
    """openapi.yaml のトップレベルのパスを拾う。YAMLの依存は足さない。"""
    with open(_SPEC, encoding="utf-8") as f:
        return re.findall(r"(?m)^  (/[^:\s]*):", f.read())


def _fill(path: str) -> str:
    """`/animals/{karte_no}/karte` を実在の値で埋める。"""
    return re.sub(r"\{([A-Za-z_]+)\}", lambda m: _SAMPLE.get(m.group(1), "1"), path)


def _split():
    allp = _spec_paths()
    screens = [p for p in allp if not p.startswith("/api") and p not in _NOT_SCREEN]
    apis = [p for p in allp if p.startswith("/api")]
    return screens, apis


def register(check, Client, Report):
    def _probe(c, paths):
        """在るもの・無いものに分ける。404 / 501 / 接続不可 を「無い」とする。"""
        missing, present = [], []
        for p in paths:
            status, _, _ = c.get(_fill(p))
            if status in (404, 501, 0):
                missing.append(f"{p}={status}")
            else:
                present.append(p)
        return present, missing

    @check("inventory", "在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）")
    def _screens(c, rep):
        screens, _ = _split()
        if len(screens) < 20:
            return False, f"画面ルートを {len(screens)} 件しか読めない（契約側を疑う）"
        present, missing = _probe(c, screens)
        if missing:
            return False, f"{len(missing)}/{len(screens)} 件が無い: {', '.join(missing[:5])}"
        return True, f"{len(present)}/{len(screens)} 件すべてある"

    @check("inventory", "在庫 契約のAPIルートが全部ある")
    def _apis(c, rep):
        _, apis = _split()
        if len(apis) < 10:
            return False, f"APIルートを {len(apis)} 件しか読めない（検査が働いていない）"
        present, missing = _probe(c, apis)
        if missing:
            return False, f"{len(missing)}/{len(apis)} 件が無い: {', '.join(missing[:5])}"
        return True, f"{len(present)}/{len(apis)} 件すべてある"

    @check("inventory", "在庫 この検査自体が働いているか（数えた対象がゼロでない）")
    def _self(c, rep):
        """検査が空振りしていないかを見る。

        検算4・検算8 で「何も比べずに緑」という事故が実際に起きた。
        同じことがここで起きないよう、**数えた対象の数そのもの**を検査にする。
        """
        screens, apis = _split()
        if not screens or not apis:
            return False, f"画面 {len(screens)} 件 / API {len(apis)} 件（読めていない）"
        return True, f"画面 {len(screens)} 件 / API {len(apis)} 件を対象にしている"
