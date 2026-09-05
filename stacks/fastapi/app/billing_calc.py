"""金額計算——会計・会計履歴・売上集計が共通で使う。

**契約が正**（`spec/acceptance.md`「数値の規則」）。ここに1本化する理由は、
3画面がそれぞれ独自に計算すると、丸めの順序が1か所でもずれて検算1・2が割れるため。
領域3のサブエージェントは、この関数を呼ぶだけで金額を出すこと。**独自に計算し直さない。**

計算順序（`spec/acceptance.md`「消費税の計算順序」より、変更禁止）:

1. 課税対象額 = 「課税かつ単価設定済み」の明細の `quantity × unit_price` の合計（丸めない）
2. 消費税額 = 課税対象額 × `tax_rate` を**伝票につき1回だけ**円未満切り捨て
3. 税抜合計 = 課税対象額 + 非課税（`is_taxable=false` かつ単価設定済み）の明細の合計
4. 税込合計 = 税抜合計 + 消費税額
5. `unit_price` が未設定の明細は、上記のどの合計にも含めない（未算入件数として別に数える）

**丸めは3・4を表示する最後の1回だけ**。内部の積み上げは丸めない小数のまま持つ。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class DetailLike:
    """明細1行ぶんの、計算に要る項目だけを持つ形。

    `BillingDetail` そのものを受け取ってもよいが、テストコードや売上集計のように
    ORMを介さない場所からも呼べるよう、最小限の形をここで定義する。
    """

    quantity: Decimal
    unit_price: int | None
    is_taxable: bool


@dataclass(frozen=True, slots=True)
class BillingTotals:
    net_amount: int  # 税抜合計
    tax_amount: int  # 消費税額
    total_amount: int  # 税込合計
    excluded_count: int  # 未算入の明細行数


def calc_billing_totals(details: list[DetailLike], tax_rate: Decimal | float) -> BillingTotals:
    """1伝票ぶんの金額を計算する。丸めは最後の1回だけ。"""
    tax_rate = Decimal(str(tax_rate))

    taxable_base = Decimal(0)  # 課税対象額（丸めない）
    non_taxable_base = Decimal(0)  # 非課税の合計（丸めない）
    excluded_count = 0

    for d in details:
        if d.unit_price is None:
            excluded_count += 1
            continue
        amount = d.quantity * Decimal(d.unit_price)
        if d.is_taxable:
            taxable_base += amount
        else:
            non_taxable_base += amount

    # 消費税額: 課税対象額 × 税率 を「伝票につき1回だけ」円未満切り捨て。
    tax_amount = int((taxable_base * tax_rate).to_integral_value(rounding="ROUND_FLOOR"))

    net_amount = int((taxable_base + non_taxable_base).to_integral_value(rounding="ROUND_FLOOR"))
    total_amount = net_amount + tax_amount

    return BillingTotals(
        net_amount=net_amount,
        tax_amount=tax_amount,
        total_amount=total_amount,
        excluded_count=excluded_count,
    )


@dataclass(frozen=True, slots=True)
class ShareRow:
    key: str
    net_amount: int
    share_pct: float


def allocate_share_pct(rows: list[tuple[str, Decimal]]) -> list[ShareRow]:
    """構成比を最大剰余法で丸める（`spec/acceptance.md`「構成比の丸め」）。

    合計が必ずちょうど100.0になることを保証する。
    対象期間の税抜合計が0円のときは呼び出し側で除外すること（ここでは0除算を避けて
    全行0.0を返す）。
    """
    total = sum((amount for _, amount in rows), Decimal(0))
    if total <= 0:
        return [ShareRow(key=k, net_amount=int(amt), share_pct=0.0) for k, amt in rows]

    raws = [(k, amt, amt / total * Decimal(100)) for k, amt in rows]
    floors = [(k, amt, raw, math.floor(raw * 10) / 10) for k, amt, raw in raws]

    # floor値の合計と100.0の差を、0.1刻みの件数に直す。浮動小数の誤差を避けるため
    # いったん10倍して整数で扱う。
    floor_tenths = [round(f * 10) for _, _, _, f in floors]
    remainder_tenths = 1000 - sum(floor_tenths)  # 100.0 を1000(=100.0*10)として扱う

    # 剰余（raw - floor）が大きい順に、remainder_tenths 件ぶん 0.1 を足す。
    order = sorted(
        range(len(floors)),
        key=lambda i: (floors[i][2] - Decimal(str(floors[i][3]))),
        reverse=True,
    )
    bumped = list(floor_tenths)
    for i in order[: max(remainder_tenths, 0)]:
        bumped[i] += 1

    return [
        ShareRow(key=floors[i][0], net_amount=int(floors[i][1]), share_pct=bumped[i] / 10)
        for i in range(len(floors))
    ]
