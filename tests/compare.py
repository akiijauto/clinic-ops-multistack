#!/usr/bin/env python3
"""5実装を同じ物差しで並べて測る（第3段階：突き合わせ）。

    python tests/compare.py                 # 動いているレーンを全部
    python tests/compare.py --only money    # 組を絞る
    python tests/compare.py --md            # 記録用にMarkdownで出す

**1つずつ測って目で見比べるのはやらない。** 26画面・13検査・5実装あるので、
人が見比べると必ず見落とす。**食い違っている行だけを浮かび上がらせる**のがこの道具の役目。
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(HERE, "run.py")

LANES = [
    ("A", "Go", 8401),
    ("B", "Rails", 8402),
    ("C", "Laravel", 8403),
    ("D", "FastAPI", 8415),
    ("E", "Next.js", 8405),
]


def run_one(port: int, only: str | None) -> dict[str, tuple[bool, str]]:
    """1実装に judge を当てて、検査名 -> (合否, 補足) を返す。"""
    cmd = [sys.executable, RUN, f"http://127.0.0.1:{port}"]
    if only:
        cmd += ["--only", only]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=600)
    except subprocess.TimeoutExpired:
        return {}
    out: dict[str, tuple[bool, str]] = {}
    for line in (p.stdout or "").splitlines():
        s = line.strip()
        for mark, ok in (("OK  ", True), ("NG  ", False)):
            if s.startswith(mark):
                body = s[len(mark):]
                name, _, detail = body.partition("  — ")
                out[name.strip()] = (ok, detail.strip())
                break
    return out


def alive(port: int) -> bool:
    import urllib.request
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=3)
        return True
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser(description="5実装を並べて測る")
    ap.add_argument("--only", help="検査の組を絞る")
    ap.add_argument("--md", action="store_true", help="Markdownの表で出す")
    a = ap.parse_args()

    live = [(k, name, port) for k, name, port in LANES if alive(port)]
    dead = [(k, name, port) for k, name, port in LANES if (k, name, port) not in live]

    if not live:
        print("動いている実装がありません。各レーンのサーバを起動してください。")
        print("ポートは coordination/PORTS.md を参照。")
        return 2

    print(f"測る対象: {', '.join(f'{k}({name}:{p})' for k, name, p in live)}")
    if dead:
        print(f"止まっている: {', '.join(f'{k}({name}:{p})' for k, name, p in dead)}")
        print("  ※ 止まっているものは**「合格」にも「不合格」にもしない**。測っていないだけ。")
    print()

    results = {k: run_one(p, a.only) for k, _, p in live}

    # 検査名の並びは、最初に測れた実装の順に揃える
    names: list[str] = []
    for k, _, _ in live:
        for n in results[k]:
            if n not in names:
                names.append(n)

    keys = [k for k, _, _ in live]
    head = ["検査"] + keys
    rows = []
    disagree = []
    for n in names:
        cells = []
        oks = []
        for k in keys:
            v = results[k].get(n)
            if v is None:
                cells.append("—")
            else:
                cells.append("OK" if v[0] else "NG")
                oks.append(v[0])
        rows.append([n] + cells)
        # **全部そろって同じでない行**＝突き合わせで見るべき行
        if oks and len(set(oks)) > 1:
            disagree.append(n)

    if a.md:
        print("| " + " | ".join(head) + " |")
        print("| " + " | ".join("---" for _ in head) + " |")
        for r in rows:
            print("| " + " | ".join(r) + " |")
    else:
        w = max((len(r[0]) for r in rows), default=10)
        print("  " + "検査".ljust(w) + "  " + "  ".join(k.center(3) for k in keys))
        print("  " + "-" * (w + 5 * len(keys)))
        for r in rows:
            print("  " + r[0].ljust(w) + "  " + "  ".join(c.center(3) for c in r[1:]))

    print()
    if disagree:
        print(f"★ 実装によって答えが違う検査が {len(disagree)} 件ある。**ここが突き合わせの対象**:")
        for n in disagree:
            detail = "  ".join(
                f"{k}={'OK' if results[k][n][0] else 'NG:' + results[k][n][1][:28]}"
                for k in keys if n in results[k])
            print(f"  - {n}")
            print(f"      {detail}")
        return 1

    allng = [n for n in names if all(results[k].get(n, (True,))[0] is False for k in keys if n in results[k])]
    if allng:
        print(f"全実装がそろって落ちている検査が {len(allng)} 件。**まだ作っていないだけ**の可能性が高い。")
    else:
        print("測れた範囲で、実装ごとの食い違いは無い。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
