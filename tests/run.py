#!/usr/bin/env python3
"""共通テスト — 5つの実装を同じ物差しで判定する。

実装の言語を問わない。**HTTP越しに叩くだけ**なので、
Go でも Rails でも Laravel でも FastAPI でも Next.js でも同じ判定になる。

    python tests/run.py http://localhost:8080
    python tests/run.py http://localhost:8080 --only smoke
    python tests/run.py http://localhost:8080 --list

各レーンは「自分で書いたテストが緑」ではなく、**これが緑**で完了とする。
自分のテストは自分の思い込みを写すが、これは全実装に同じ問いを投げる。

依存を足さない（標準ライブラリだけ）。5つの環境で同じものを走らせるので、
入れるものが増えるほど「動かない理由」が増える。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

TIMEOUT = 20

# 出力をUTF-8に固定する。
# Windowsの既定は cp932 で、日本語やダッシュ記号を出そうとすると
# UnicodeEncodeError で**テスト自体が落ちる**（2026-09-05 実測）。
# 5つのレーンが全部Windowsで走らせるので、ここで揃えておく。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# ── 判定の器 ────────────────────────────────────────

@dataclass
class Result:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class Report:
    results: list[Result] = field(default_factory=list)

    def add(self, name: str, ok: bool, detail: str = "") -> None:
        self.results.append(Result(name, ok, detail))

    @property
    def failed(self) -> list[Result]:
        return [r for r in self.results if not r.ok]

    def render(self) -> int:
        for r in self.results:
            mark = "  OK  " if r.ok else "  NG  "
            line = mark + r.name
            if r.detail:
                line += "  — " + r.detail
            print(line)
        print()
        n, ng = len(self.results), len(self.failed)
        if ng == 0:
            print(f"全 {n} 件 通過")
            return 0
        print(f"{n} 件中 {ng} 件 失敗")
        return 1


# ── HTTP ──────────────────────────────────────────

class Client:
    """叩くだけの薄い口。

    リダイレクトは追う（画面の実装によっては保存後に飛ばすため）。
    エラーでも例外にせず、状態と本文を返す。**判定するのは呼び出し側**。
    """

    def __init__(self, base: str):
        self.base = base.rstrip("/")

    def request(self, method: str, path: str, body=None, headers=None):
        url = self.base + path
        data = None
        h = {"Accept": "text/html,application/json"}
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            h["Content-Type"] = "application/json"
        if headers:
            h.update(headers)
        req = urllib.request.Request(url, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
                return res.status, res.read().decode("utf-8", "replace"), dict(res.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)
        except Exception as e:  # 接続できない等
            return 0, f"{type(e).__name__}: {e}", {}

    def get(self, path: str, **kw):
        return self.request("GET", path, **kw)

    def post(self, path: str, body=None, **kw):
        return self.request("POST", path, body=body, **kw)

    def get_json(self, path: str):
        status, text, _ = self.get(path)
        try:
            return status, json.loads(text)
        except Exception:
            return status, None


# ── 検査の登録 ──────────────────────────────────────

CHECKS: dict[str, list] = {}


def check(group: str, name: str):
    """検査を登録する。group で絞り込める。"""
    def deco(fn):
        CHECKS.setdefault(group, []).append((name, fn))
        return fn
    return deco


# ── smoke：最初に通すもの ────────────────────────────
#
# **レーンが最初に緑にするのはここ。** 契約が凍る前でも通せるように、
# health だけは独立させてある。

@check("smoke", "GET /healthz が 200 で {\"status\":\"ok\"} を返す")
def _healthz(c: Client, rep: Report):
    status, body = c.get_json("/healthz")
    if status != 200:
        return False, f"status={status}"
    if not isinstance(body, dict) or body.get("status") != "ok":
        return False, f"body={body!r}"
    return True, ""


@check("smoke", "起動していて、応答が返る")
def _reachable(c: Client, rep: Report):
    t0 = time.time()
    status, _, _ = c.get("/healthz")
    if status == 0:
        return False, "接続できない"
    return True, f"{(time.time()-t0)*1000:.0f}ms"


# ── 検算9項目を読み込む ──────────────────────────────
#
# 別ファイル(checks.py)に置いてある。ここに全部書くと1000行を超えて読めなくなる。
# 期待値は expected.py が data/ から独立に計算する。

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import checks as _checks
    _checks.register(check, Client, Report)
except Exception as _e:  # 検算が読めなくても smoke は走らせる
    print(f"※ 検算を読み込めませんでした: {type(_e).__name__}: {_e}", file=sys.stderr)


# ── 実行 ─────────────────────────────────────────

def run(base: str, only: str | None) -> int:
    c = Client(base)
    rep = Report()

    groups = [only] if only else list(CHECKS.keys())
    for g in groups:
        if g not in CHECKS:
            print(f"そのような検査の組はありません: {g}", file=sys.stderr)
            return 2
        print(f"── {g} ──")
        for name, fn in CHECKS[g]:
            try:
                ok, detail = fn(c, rep)
            except Exception as e:
                ok, detail = False, f"検査自体が落ちた: {type(e).__name__}: {e}"
            rep.add(name, ok, detail)
        print()

    return rep.render()


def main() -> int:
    p = argparse.ArgumentParser(description="5実装を同じ物差しで判定する")
    p.add_argument("base", nargs="?", help="対象のURL 例: http://localhost:8080")
    p.add_argument("--only", help="検査の組を1つだけ走らせる")
    p.add_argument("--list", action="store_true", help="検査の組を並べて終わる")
    a = p.parse_args()

    if a.list:
        for g, items in CHECKS.items():
            print(f"{g}  ({len(items)}件)")
            for name, _ in items:
                print(f"    {name}")
        return 0

    if not a.base:
        p.error("対象のURLを指定してください")
    return run(a.base, a.only)


if __name__ == "__main__":
    sys.exit(main())
