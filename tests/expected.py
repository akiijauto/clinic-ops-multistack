"""期待値を `data/` から独立に計算する。

**実装のコードを一切通さない。** 実装が返した数字を実装のロジックで検算しても
「同じ間違いを2回する」だけで、何も確かめたことにならない。

`spec/acceptance.md` の定義に従う。定義を変えるときは acceptance.md を先に直すこと。
"""
from __future__ import annotations

import json
import os
from collections import defaultdict

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load(name: str):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


class Fixture:
    """合成データを読んで、検算に使う形に整えたもの。"""

    def __init__(self):
        self.seed = _load("seed.json")
        self.prices = {p["price_code"]: p for p in _load("price_items.json")}
        self.lab_items = {i["item_code"]: i for i in _load("lab_items.json")}

        self.patients = {p["id"]: p for p in self.seed["patients"]}
        self.billings = {b["id"]: b for b in self.seed["billings"]}
        self.lab_tests = {t["id"]: t for t in self.seed["lab_tests"]}

        self.details_by_billing = defaultdict(list)
        for d in self.seed["billing_details"]:
            self.details_by_billing[d["billing_id"]].append(d)

    # ── 検算1・2：売上 ───────────────────────────

    def _unit_price(self, detail) -> int | None:
        """明細の単価。**未設定なら None を返す。**

        `unit_price` が明細に無ければ料金マスタから引く。
        どちらにも無ければ未設定であり、**0として扱わない**（acceptance.md 検算2）。
        """
        v = detail.get("unit_price")
        if v is not None:
            return v
        item = self.prices.get(detail.get("price_code"))
        return item.get("unit_price") if item else None

    def _category_major(self, detail) -> str | None:
        item = self.prices.get(detail.get("price_code"))
        if not item:
            return None
        return item.get("category_major") or item.get("category")

    def sales(self, date_from: str | None = None, date_to: str | None = None) -> dict:
        """税抜売上を分類別・担当別・日別・総合計で返す。

        対象は `status = confirmed` の伝票だけ（`draft` は売上ではない）。
        未算入（単価未設定）の明細は**どの合計にも入れない**。
        """
        by_cat: dict[str, int] = defaultdict(int)
        by_staff: dict[int, int] = defaultdict(int)
        by_date: dict[str, int] = defaultdict(int)
        total = 0
        excluded_rows = 0

        for b in self.seed["billings"]:
            if b.get("status") != "confirmed":
                continue
            day = (b.get("billed_on") or "")[:10]
            if date_from and day < date_from:
                continue
            if date_to and day > date_to:
                continue

            for d in self.details_by_billing.get(b["id"], []):
                up = self._unit_price(d)
                if up is None:
                    excluded_rows += 1
                    continue
                amount = int(round(d.get("quantity", 0) * up))
                total += amount
                by_date[day] += amount
                by_staff[b.get("staff_id")] += amount
                cat = self._category_major(d)
                if cat is not None:
                    by_cat[cat] += amount

        return {
            "total": total,
            "by_category": dict(by_cat),
            "by_staff": dict(by_staff),
            "by_date": dict(by_date),
            "excluded_rows": excluded_rows,
        }

    def billing_amounts(self, billing_id: int) -> dict:
        """1枚の伝票の税抜合計・消費税額・税込合計・未算入行数。

        消費税は**伝票単位で1回だけ切り捨て**（acceptance.md 数値の規則）。
        明細ごとに丸めると、丸めの回数だけ誤差が積み上がる。
        """
        b = self.billings[billing_id]
        net = 0
        taxable = 0
        excluded = 0
        for d in self.details_by_billing.get(billing_id, []):
            up = self._unit_price(d)
            if up is None:
                excluded += 1
                continue
            amount = int(round(d.get("quantity", 0) * up))
            net += amount
            item = self.prices.get(d.get("price_code")) or {}
            if d.get("is_taxable", item.get("is_taxable", True)):
                taxable += amount

        rate = self.seed.get("clinic", {}).get("tax_rate", 0.10)
        tax = int(taxable * rate)  # 円未満切り捨て・1回だけ
        return {"net": net, "tax": tax, "total": net + tax, "excluded_count": excluded}

    # ── 検算3：固定値が現れない ──────────────────────

    def temperature_values(self) -> list[float]:
        return [r["temperature_c"] for r in self.seed["progress_notes"]
                if r.get("temperature_c") is not None]

    # ── 検算5：検査の範囲外 ────────────────────────

    def _ref_range(self, item_code: str, species: str, sex: str):
        m = self.lab_items.get(item_code)
        if not m:
            return None
        for r in m.get("reference_ranges", []):
            if r["species"] == species and r["sex"] in ("any", sex):
                return r
        for r in m.get("reference_ranges", []):
            if r["species"] == "other":
                return r
        return None

    def lab_judgments(self) -> dict[int, str]:
        """検査項目ごとの判定。'' / 'H' / 'L'。"""
        out: dict[int, str] = {}
        for it in self.seed["lab_test_items"]:
            v = it.get("value_num")
            if v is None:
                out[it["id"]] = ""
                continue
            t = self.lab_tests.get(it["lab_test_id"])
            p = self.patients.get(t["patient_id"]) if t else None
            r = self._ref_range(it["item_code"], p.get("species"), p.get("sex")) if p else None
            if not r:
                out[it["id"]] = ""
            elif v > r["high"]:
                out[it["id"]] = "H"
            elif v < r["low"]:
                out[it["id"]] = "L"
            else:
                out[it["id"]] = ""
        return out

    # ── 検算6：予約の重なり ────────────────────────

    def reservation_conflicts(self) -> list[tuple]:
        """重なっている組を返す。**半開区間**（終了＝次の開始は重ならない）。"""
        bad = []
        for key in ("staff_id", "room"):
            g = defaultdict(list)
            for r in self.seed["reservations"]:
                if r.get("status") == "cancelled":
                    continue
                g[r.get(key)].append((r["starts_at"], r["ends_at"], r["id"]))
            for owner, rows in g.items():
                rows.sort()
                for i in range(1, len(rows)):
                    if rows[i][0] < rows[i - 1][1]:
                        bad.append((key, owner, rows[i - 1][2], rows[i][2]))
        return bad

    # ── 検算7：入院記録の実施者 ─────────────────────

    def care_records_without_operator(self) -> list[int]:
        return [r["id"] for h in self.seed["hospitalizations"]
                for r in h.get("care_records", [])
                if not r.get("performed_by_staff_id")]

    # ── 検算9：消したものが数に残る ───────────────────

    def deleted_counts(self) -> dict[str, int]:
        return {k: sum(1 for x in self.seed[k] if x.get("deleted_at"))
                for k in ("owners", "patients", "visits")}


if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    f = Fixture()
    s = f.sales()
    print("=== data/ から独立に計算した期待値 ===")
    print(f"  税抜売上 総合計      : {s['total']:,}")
    print(f"  分類別の合計を足す   : {sum(s['by_category'].values()):,}")
    print(f"  担当別の合計を足す   : {sum(s['by_staff'].values()):,}")
    print(f"  日別の合計を足す     : {sum(s['by_date'].values()):,}")
    print(f"  未算入の明細行       : {s['excluded_rows']} 行")
    agree = (s["total"] == sum(s["by_category"].values())
             == sum(s["by_staff"].values()) == sum(s["by_date"].values()))
    print(f"  → 3方向一致: {'OK' if agree else '★合わない（期待値の計算が間違っている）'}")
    j = f.lab_judgments()
    print(f"\n  検査の判定: H={sum(1 for v in j.values() if v=='H')} "
          f"L={sum(1 for v in j.values() if v=='L')} "
          f"空={sum(1 for v in j.values() if v=='')}")
    print(f"  予約の重なり: {len(f.reservation_conflicts())} 件")
    print(f"  実施者が空の記録行: {len(f.care_records_without_operator())} 件")
    print(f"  体温の異なり数: {len(set(f.temperature_values()))}")
    print(f"  削除済み: {f.deleted_counts()}")
