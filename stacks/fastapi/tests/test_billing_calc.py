"""金額計算の見張り。契約（`spec/acceptance.md`）に対する土台の正しさを確かめる。

**これはレーンDの手元の見張りであって、共通テストではない。** 完了の判定は
リポジトリ直下の `tests/`（検算1・検算2）が行う。
"""

from __future__ import annotations

from decimal import Decimal

from app.billing_calc import DetailLike, allocate_share_pct, calc_billing_totals


def test_excluded_detail_is_not_counted_as_zero():
    """検算2：単価未設定行は合計に0円として含めず、件数だけ数える。"""
    details = [
        DetailLike(Decimal("2"), 1000, True),
        DetailLike(Decimal("1"), 500, False),
        DetailLike(Decimal("3"), None, True),
    ]
    r = calc_billing_totals(details, Decimal("0.10"))
    assert r.excluded_count == 1
    assert r.net_amount == 2500
    assert r.tax_amount == 200
    assert r.total_amount == 2700


def test_tax_is_floored_once_per_billing_not_per_line():
    """伝票につき1回だけ切り捨てる。明細ごとに切り捨てて積み上げない。"""
    # 3行 × 333円 × 8% = 各行 26.64円。行ごとに切り捨てると 26*3=78円になるが、
    # 伝票単位（999円 × 8% = 79.92円 → 79円）が正しい。
    details = [DetailLike(Decimal("1"), 333, True) for _ in range(3)]
    r = calc_billing_totals(details, Decimal("0.08"))
    assert r.tax_amount == 79  # 行ごと切り捨てなら78になってしまう


def test_zero_details_gives_zero_totals():
    r = calc_billing_totals([], Decimal("0.10"))
    assert r == calc_billing_totals([], Decimal("0.10"))
    assert r.net_amount == 0
    assert r.tax_amount == 0
    assert r.total_amount == 0
    assert r.excluded_count == 0


def test_share_pct_always_sums_to_exactly_100():
    """最大剰余法：割り切れない分配でも合計は必ずちょうど100.0。"""
    cases = [
        [("a", Decimal("1")), ("b", Decimal("1")), ("c", Decimal("1"))],
        [("a", Decimal("1")), ("b", Decimal("2")), ("c", Decimal("7"))],
        [("a", Decimal("1"))],
        [("a", Decimal("123")), ("b", Decimal("456")), ("c", Decimal("789")), ("d", Decimal("1"))],
    ]
    for rows in cases:
        shares = allocate_share_pct(rows)
        assert sum(s.share_pct for s in shares) == 100.0, rows


def test_share_pct_is_zero_when_total_is_zero():
    """対象期間の税抜合計が0円のときは、この検算自体を対象外とする（acceptance.md）。

    ここでは0除算を避けて全行0.0を返すだけにする。「対象外にする」判断は
    呼び出し側（画面・テスト側)の仕事。
    """
    shares = allocate_share_pct([("a", Decimal("0")), ("b", Decimal("0"))])
    assert all(s.share_pct == 0.0 for s in shares)
