"""実際にブラウザで描画して、5実装を見比べる。

**なぜ要るか（2026-09-06、オーナーの指摘）**

    いくら計画や契約があっていても、実績確認ができないのであれば意味がありません。

判定器は「CSSを配ったか」「クラスが付いたか」までは見ていた。
**描画結果は一度も見ていなかった。** その結果「見た目が揃った」と報告したが、
オーナーが5つの画面を並べたところ、**題名も見出しもナビの有無もバラバラ**だった。

    HTMLが同じ規則を満たすことと、**同じに見えること**は別。

ここでは本物のブラウザ（Chromium）で開いて撮る。撮った絵は人が見る。
**機械が「揃っている」と言えるのは、揃っていないことを見つけられる範囲まで**なので、
ここでは判定せず、**並べて見せることに徹する**。

使い方:
    python tests/shots.py                # 主要画面を5実装ぶん撮る
    python tests/shots.py /sales /today  # 画面を指定して撮る

出力: tests/shots/<画面名>/<実装>.png と、並べて見るための index.html
"""
from __future__ import annotations

import os
import re
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

TARGETS = [
    ("Go", 8401), ("Rails", 8414), ("Laravel", 8403),
    ("FastAPI", 8415), ("Next.js", 8405),
]

DEFAULT_PATHS = [
    "/", "/today", "/sales", "/dm", "/ward",
    "/reservations", "/settings", "/about", "/folded",
    "/animals/10003/karte", "/animals/10003/exam", "/animals/10003/accounting",
]


def slug(path: str) -> str:
    s = path.strip("/").replace("/", "_") or "top"
    return re.sub(r"[^A-Za-z0-9_.-]", "-", s)


def main(paths):
    from playwright.sync_api import sync_playwright

    os.makedirs(OUT, exist_ok=True)
    rows = []
    with sync_playwright() as p:
        # **暗い配色でも撮る。** オーナーの画面は暗かった。
        # 明るい前提だけで確かめると、実際に見えているものを見ないことになる。
        for scheme in ("light", "dark"):
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 1280, "height": 900},
                                color_scheme=scheme)
            page = ctx.new_page()
            for path in paths:
                for name, port in TARGETS:
                    d = os.path.join(OUT, slug(path))
                    os.makedirs(d, exist_ok=True)
                    f = os.path.join(d, f"{name}-{scheme}.png")
                    try:
                        page.goto(f"http://127.0.0.1:{port}{path}",
                                  timeout=15000, wait_until="load")
                        title = page.title()
                        h1 = page.locator("h1").first
                        h1t = h1.inner_text() if h1.count() else ""
                        navs = page.locator("nav a")
                        links = [navs.nth(i).inner_text().strip()
                                 for i in range(min(navs.count(), 20))]
                        page.screenshot(path=f, full_page=False)
                        rows.append((path, name, scheme, title, h1t.strip(), links))
                    except Exception as e:
                        rows.append((path, name, scheme, f"取得失敗: {e}", "", []))
            b.close()

    # 並べて見るためのページ
    html = ["<meta charset='utf-8'><title>5実装の見比べ</title>",
            "<style>body{font-family:sans-serif;background:#111;color:#eee;margin:0;padding:16px}"
            "h2{margin:28px 0 8px}img{width:100%;border:1px solid #444;background:#fff}"
            ".g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}"
            ".c{font-size:12px}.t{color:#9cf}.d{color:#fa8}</style>",
            "<h1>5実装の見比べ（実際にブラウザで描画したもの）</h1>"]
    for path in paths:
        d = slug(path)
        for scheme in ("light", "dark"):
            html.append(f"<h2>{path} <span class='c'>（{scheme}）</span></h2><div class='g'>")
            for name, _ in TARGETS:
                info = [r for r in rows if r[0] == path and r[1] == name and r[2] == scheme]
                t = info[0][3] if info else ""
                h = info[0][4] if info else ""
                html.append(f"<div><div class='c'><b>{name}</b><br>"
                            f"<span class='t'>title: {t}</span><br>"
                            f"<span class='d'>h1: {h}</span></div>"
                            f"<img src='{d}/{name}-{scheme}.png'></div>")
            html.append("</div>")
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write("\n".join(html))

    # 食い違いを文字で出す（人が絵を見る前に、機械で分かる差は先に出す）
    print(f"撮影: {len(rows)} 枚 → {OUT}")
    print()
    for path in paths:
        vals = {}
        for r in rows:
            if r[0] == path and r[2] == "light":
                vals[r[1]] = (r[3], r[4], tuple(r[5]))
        if len(set(vals.values())) > 1:
            print(f"★ {path} — 実装によって違う")
            for n, (t, h, lk) in vals.items():
                print(f"    {n:<8} title={t[:34]:<34} h1={h[:26]:<26} nav={len(lk)}本")
        else:
            print(f"  {path} — 揃っている")


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT_PATHS)
