<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Clinic;

/**
 * 会計の金額計算。spec/acceptance.md「消費税の計算順序」を一字一句そのまま実装する。
 *
 * 手順（順序を変えない。理由は acceptance.md 参照 — 明細ごとに丸めると
 * 伝票内で誤差が積み上がり、5実装が1円単位で割れるため）:
 *   1. 課税対象額 = is_taxable=true かつ unit_price設定ありの明細の quantity×unit_price 合計（丸めない）
 *   2. 消費税額 = floor(課税対象額 × tax_rate)（伝票につき1回だけ切り捨て）
 *   3. 税抜合計 = 課税対象額 + 非課税明細（unit_price設定あり）の合計
 *   4. 税込合計 = 税抜合計 + 消費税額
 *   5. unit_price 未設定の明細は、どの合計にも含めない
 *
 * 丸めた値を再度合計しない。合計は丸める前の値を足し、最後に1回だけ丸める。
 */
class BillingCalculator
{
    public function calculate(Billing $billing): BillingTotals
    {
        $taxableSubtotal = '0';   // 文字列のまま bcmath で保持し、最後に1回だけ丸める
        $nontaxableSubtotal = '0';
        $excludedCount = 0;

        foreach ($billing->details as $detail) {
            if (! $detail->hasPrice()) {
                // unit_price 未設定。0円として合計に入れない。件数だけ数える。
                $excludedCount++;

                continue;
            }

            $amount = bcmul((string) $detail->quantity, (string) $detail->unit_price, 6);

            if ($detail->is_taxable) {
                $taxableSubtotal = bcadd($taxableSubtotal, $amount, 6);
            } else {
                $nontaxableSubtotal = bcadd($nontaxableSubtotal, $amount, 6);
            }
        }

        $taxRate = (string) Clinic::current()->tax_rate;

        // 消費税額：課税対象額 × 税率を、伝票につき1回だけ円未満切り捨て。
        $taxAmount = $this->floorToYen(bcmul($taxableSubtotal, $taxRate, 6));

        // 税抜合計・税込合計は「表示する最後の1回だけ」円未満切り捨て。
        $netAmount = $this->floorToYen(bcadd($taxableSubtotal, $nontaxableSubtotal, 6));
        $totalAmount = $netAmount + $taxAmount;

        return new BillingTotals(
            netAmount: $netAmount,
            taxAmount: $taxAmount,
            totalAmount: $totalAmount,
            excludedDetailCount: $excludedCount,
            taxableSubtotal: $this->floorToYen($taxableSubtotal),
            nontaxableSubtotal: $this->floorToYen($nontaxableSubtotal),
        );
    }

    /**
     * 円未満切り捨て。bcmath の scale=0 は丸めではなく「桁を切り捨てる」動作なので、
     * 非負の金額に対しては floor() と同じ結果になる（2026-09-05 実測で確認済み）。
     */
    private function floorToYen(string $amount): int
    {
        return (int) bcadd($amount, '0', 0);
    }
}
