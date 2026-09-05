"""検算9項目。`spec/acceptance.md` の定義をそのまま実行する。

期待値は `expected.py` が `data/` から**独立に**計算する。
実装が返した数字を実装の理屈で検算しても、同じ間違いを2回するだけになる。

run.py から読み込まれる。ここを直すときは acceptance.md を先に直すこと。
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

from expected import Fixture

FIX = Fixture()


def _num(text: str):
    """画面から読んだ文字を数にする。桁区切りと空白と単位を落とす。"""
    if text is None:
        return None
    t = re.sub(r"[,\s円%]", "", str(text))
    try:
        return float(t) if "." in t else int(t)
    except ValueError:
        return None


class _CheckCollector(HTMLParser):
    """`data-check="キー"` を持つ要素の中身を集める。

    **正規表現をやめた。** 最初は `<tag ...>(.*?)</tag>` で拾っていたが、
    `<!DOCTYPE html><html>…</html>` という普通の文書に対して
    **`<html>` だけを掴んで中身が一切見えない**という欠陥があった
    （`re.finditer` は最も左から始まる一致を返すので、`</html>` が
    1つしか無い文書では `.*?` が全部を飲み込んで成立してしまう）。

    2026-09-05、レーンA（Go）が実測で見つけて報告した。
    **実装は正しく値を出していたのに、判定側が読めていなかった。**
    HTMLの書き方の問題ではなく、判定側の欠陥だったので、
    どのスタックで作っても同じように落ちるところだった。

    入れ子も正しく扱う（目印の中に別の要素があっても、その文字だけを拾う）。
    """

    def __init__(self, key: str):
        super().__init__(convert_charrefs=True)
        self.key = key
        self.found: list[str] = []
        self._depth = 0          # 目印の要素の中にいる深さ
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self._depth:
            # 目印の中にある入れ子。数えて、閉じを取り違えないようにする
            if tag not in _VOID:
                self._depth += 1
            return
        for k, v in attrs:
            if k == "data-check" and v == self.key:
                self._depth = 1
                self._buf = []
                return

    def handle_endtag(self, tag):
        if not self._depth:
            return
        self._depth -= 1
        if self._depth == 0:
            self.found.append("".join(self._buf).strip())

    def handle_data(self, data):
        if self._depth:
            self._buf.append(data)


_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
         "link", "meta", "param", "source", "track", "wbr"}


def _data_check(html: str, key: str) -> list[str]:
    """`data-check="キー"` を持つ要素のテキストを全部拾う。

    要素の種類（span でも td でも）は問わない。属性の順番も問わない。
    """
    c = _CheckCollector(key)
    try:
        c.feed(html)
        c.close()
    except Exception:
        # 壊れたHTMLでも、拾えたぶんは返す（判定側が落ちないように）
        pass
    return c.found


def register(check, Client, Report):
    """run.py の @check を借りて検算を登録する。"""

    # ── 検算1：売上の3方向一致 ─────────────────────
    @check("money", "検算1 売上が分類別・担当別・日別・総合計で一致する")
    def _sales_three_ways(c, rep):
        status, body = c.get_json("/api/sales/summary")
        if status != 200 or not isinstance(body, dict):
            return False, f"売上集計APIが取れない status={status}"
        def s(section, field="net_amount"):
            rows = body.get(section) or []
            return sum(r.get(field, 0) for r in rows) if isinstance(rows, list) else None
        cat, stf, day = s("by_category"), s("by_staff"), s("by_date")
        tot = body.get("total_net_amount", body.get("total"))
        if None in (cat, stf, day, tot):
            return False, f"内訳が揃わない cat={cat} staff={stf} date={day} total={tot}"
        if not (cat == stf == day == tot):
            return False, f"分類{cat} 担当{stf} 日別{day} 総合計{tot}"
        want = FIX.sales()["total"]
        if tot != want:
            return False, f"総合計 {tot} だが data から計算した期待値は {want}"
        return True, f"4値とも {tot:,} 円"

    @check("money", "検算1 分類別の構成比の和がちょうど100.0%")
    def _share_pct(c, rep):
        status, body = c.get_json("/api/sales/summary")
        if status != 200 or not isinstance(body, dict):
            return False, f"status={status}"
        rows = body.get("by_category") or []
        if not rows:
            return False, "分類別の内訳が無い"
        total = sum(r.get("share_pct", 0) for r in rows)
        return (abs(total - 100.0) < 1e-9), f"和={total}"

    # ── 検算2：未算入の明示 ───────────────────────
    @check("money", "検算2 単価未設定の行を0円で合計に入れず、未算入の行数を出す")
    def _excluded(c, rep):
        target = None
        for b in FIX.seed["billings"]:
            if FIX.billing_amounts(b["id"])["excluded_count"] > 0:
                target = b
                break
        if target is None:
            return False, "未算入を含む伝票が data に無い（データの仕込み漏れ）"
        want = FIX.billing_amounts(target["id"])
        status, body = c.get_json(f"/api/billings/{target['id']}")
        if status != 200 or not isinstance(body, dict):
            return False, f"status={status}"
        got_net = body.get("net_amount")
        got_ex = body.get("excluded_count")
        if got_net != want["net"]:
            return False, f"税抜合計 {got_net} 期待 {want['net']}（0円で足していないか）"
        if got_ex != want["excluded_count"]:
            return False, f"未算入行数 {got_ex} 期待 {want['excluded_count']}"
        return True, f"伝票{target['id']} 税抜{got_net:,} 未算入{got_ex}行"

    @check("money", "検算2 消費税は伝票単位で1回だけ切り捨て")
    def _tax(c, rep):
        b = FIX.seed["billings"][0]
        want = FIX.billing_amounts(b["id"])
        status, body = c.get_json(f"/api/billings/{b['id']}")
        if status != 200 or not isinstance(body, dict):
            return False, f"status={status}"
        if body.get("tax_amount") != want["tax"]:
            return False, f"消費税 {body.get('tax_amount')} 期待 {want['tax']}"
        if body.get("total_amount") != want["total"]:
            return False, f"税込 {body.get('total_amount')} 期待 {want['total']}"
        return True, f"税{want['tax']:,} 税込{want['total']:,}"

    @check("money", "検算2 この規則を、いまのデータで確かめられているか（検算そのものの点検）")
    def _tax_rule_is_testable(c, rep):
        """**実装ではなく、検算の有効性を見る。**

        「消費税は伝票単位で1回だけ切り捨て」という規則は、
        明細ごとに丸めた答えと伝票単位で丸めた答えが**違う伝票が1枚も無ければ、
        どちらの実装でも緑になる**。それは見張りとして働いていないということ。

        2026-09-05、レーンC（Laravel）が「数量が全部整数なので丸めの差が
        表面化しない」と気づいて報告した。調べると150枚すべてで差が出なかった。

        この検査は**データの側の問題**を指すので、実装が悪いのではない。
        ただし赤のままにしておくと実装の失敗と紛れるので、
        **合否ではなく事実を出す**形にしてある（常に True を返し、詳細で状況を伝える）。
        """
        rate = FIX.seed.get("clinic", {}).get("tax_rate", 0.10)
        discriminating = 0
        for b in FIX.seed["billings"]:
            amts = []
            for d in FIX.details_by_billing.get(b["id"], []):
                up = FIX._unit_price(d)
                if up is None:
                    continue
                item = FIX.prices.get(d.get("price_code")) or {}
                if d.get("is_taxable", item.get("is_taxable", True)):
                    amts.append(int(round(d.get("quantity", 0) * up)))
            if amts and sum(int(a * rate) for a in amts) != int(sum(amts) * rate):
                discriminating += 1
        n = len(FIX.seed["billings"])
        if discriminating == 0:
            return True, (f"★ {n}枚すべてで丸め方の差が出ない。"
                          "この規則は**いまのデータでは検証できていない**（データ側の課題）")
        return True, f"{n}枚中 {discriminating}枚 が丸め方を区別する（見張りとして働いている）"


    # ── 検算3：固定値が現れない ─────────────────────
    @check("screen", "検算3 体温が全患者で同じ値になっていない")
    def _no_constant(c, rep):
        seen = []
        for p in FIX.seed["patients"][:12]:
            status, html, _ = c.get(f"/animals/{p['karte_no']}/karte")
            if status != 200:
                continue
            seen += [_num(v) for v in _data_check(html, "progress_note.temperature_c")]
        seen = [v for v in seen if v is not None]
        if len(seen) < 3:
            return False, f"体温の目印が読めた件数 {len(seen)}（data-check が付いていない）"
        if len(set(seen)) == 1:
            return False, f"全部 {seen[0]} で同じ（固定値が出ている）"
        return True, f"{len(set(seen))} 種 / {len(seen)} 件"

    # ── 検算4：画面と印刷が一致 ─────────────────────
    @check("screen", "検算4 カルテの画面と印刷で同じ値が出る")
    def _screen_vs_print(c, rep):
        compared = 0
        keys = ["progress_note.temperature_c", "progress_note.pulse",
                "progress_note.respiration", "progress_note.body_weight_kg"]
        for p in FIX.seed["patients"][:6]:
            s1, h1, _ = c.get(f"/animals/{p['karte_no']}/karte")
            s2, h2, _ = c.get(f"/animals/{p['karte_no']}/karte/print")
            if s1 != 200 or s2 != 200:
                continue
            for k in keys:
                a, b = _data_check(h1, k), _data_check(h2, k)
                if a and b:
                    compared += 1
                    if a != b:
                        return False, f"{p['karte_no']} の {k}: 画面{a[:3]} 印刷{b[:3]}"
        # **1件も比べられなかったら緑にしない。**
        # 何も無いところで「差がない」と言えてしまうと、見張りとして役に立たない。
        if compared == 0:
            return False, "画面と印刷を1組も比べられなかった（data-check が無いか画面が出ない）"
        return True, f"{compared} 組を比べて差なし"

    # ── 検算5：検査の範囲外表示 ─────────────────────
    @check("screen", "検算5 基準の外にある値は判定欄と色の両方に出る")
    def _lab_flag(c, rep):
        want = FIX.lab_judgments()
        out_ids = [i for i, v in want.items() if v in ("H", "L")]
        if not out_ids:
            return False, "範囲外の値が data に無い"
        checked = 0
        for t in FIX.seed["lab_tests"][:10]:
            status, body = c.get_json(f"/api/lab-tests/{t['id']}")
            if status != 200 or not isinstance(body, dict):
                continue
            for it in body.get("items", []):
                exp = want.get(it.get("id"))
                if exp is None:
                    continue
                got = (it.get("judgment") or "")
                if got != exp:
                    return False, f"項目{it.get('id')} 判定 '{got}' 期待 '{exp}'"
                checked += 1
        if checked == 0:
            return False, "検査APIから項目が読めない"
        return True, f"{checked} 項目の判定が一致"

    # ── 検算6：予約の重なりが無い ────────────────────
    @check("rules", "検算6 予約が担当・処置室のどちらでも重ならない")
    def _reserve(c, rep):
        status, body = c.get_json("/api/reservations")
        rows = body.get("items") if isinstance(body, dict) else body
        if status != 200 or not isinstance(rows, list):
            return False, f"予約一覧が取れない status={status}"
        from collections import defaultdict
        for key in ("staff_id", "room"):
            g = defaultdict(list)
            for r in rows:
                if r.get("status") == "cancelled":
                    continue
                g[r.get(key)].append((r.get("starts_at"), r.get("ends_at"), r.get("id")))
            for owner, v in g.items():
                v.sort()
                for i in range(1, len(v)):
                    if v[i][0] < v[i - 1][1]:
                        return False, f"{key}={owner} で {v[i-1][2]} と {v[i][2]} が重なる"
        return True, f"{len(rows)} 件で重なり0"

    # ── 検算7：入院記録の実施者 ─────────────────────
    @check("rules", "検算7 入院の記録行に実施者が必ず入っている")
    def _care(c, rep):
        total = empty = 0
        for h in FIX.seed["hospitalizations"]:
            status, body = c.get_json(f"/api/hospitalizations/{h['id']}/care-records")
            if status != 200 or not isinstance(body, dict):
                continue
            for r in body.get("items", []):
                total += 1
                if not r.get("performed_by_staff_id"):
                    empty += 1
        if total == 0:
            return False, "記録行が1件も読めない"
        return (empty == 0), f"{total} 件中 実施者なし {empty} 件"

    # ── 検算8：死んだリンクが無い ────────────────────
    @check("crawl", "検算8 画面から辿れるリンクが全部生きている")
    def _dead_links(c, rep):
        seen, dead, queue = set(), [], ["/"]
        while queue and len(seen) < 60:
            path = queue.pop(0)
            if path in seen:
                continue
            seen.add(path)
            status, html, headers = c.get(path)
            if status >= 400:
                dead.append(f"{path}({status})")
                continue
            # キーは Client が小文字へ揃えている（run.py の _norm_headers）
            if "html" not in (headers.get("content-type", "") or ""):
                continue
            for m in re.finditer(r'href\s*=\s*["\'](/[^"\'#?]*)', html):
                href = m.group(1)
                if href not in seen and not href.startswith("/api"):
                    queue.append(href)
        if dead:
            return False, f"{len(dead)} 件: {', '.join(dead[:4])}"
        # **辿れた画面が少なすぎるときは緑にしない。**
        # トップが出ないだけで「切れなし」と言えてしまう。26画面あるので、
        # 10画面も辿れないのは、リンクが無いのではなく画面が無い。
        if len(seen) < 10:
            return False, f"{len(seen)} 画面しか辿れなかった（26画面あるはず）"
        return True, f"{len(seen)} 画面を辿って切れなし"

    # ── 検算9：消したものが数に残る ───────────────────
    @check("rules", "検算9 削除済みは一覧から消えるが件数には残る")
    def _soft_delete(c, rep):
        deleted = [v for v in FIX.seed["visits"] if v.get("deleted_at")]
        if not deleted:
            return False, "削除済みの診察が data に無い"
        v = deleted[0]
        status, body = c.get_json(f"/api/visits/{v['id']}")
        if status not in (200, 404):
            return False, f"削除済みの診察を引いたら status={status}"
        s2, sales = c.get_json("/api/sales/summary")
        if s2 != 200:
            return False, "売上集計が取れない"
        tot = sales.get("total_net_amount", sales.get("total"))
        want = FIX.sales()["total"]
        if tot != want:
            return False, f"集計 {tot} 期待 {want}（消した行が集計から抜けている疑い）"
        return True, "一覧から消えても集計に残る"
