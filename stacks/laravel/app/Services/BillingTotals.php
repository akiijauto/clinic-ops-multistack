<?php

namespace App\Services;

/**
 * 会計1伝票ぶんの計算結果。すべて円未満を切り捨てた最終表示値
 * （spec/acceptance.md の丸め規則をすでに適用済み）。
 */
final class BillingTotals
{
    public function __construct(
        public readonly int $netAmount,
        public readonly int $taxAmount,
        public readonly int $totalAmount,
        public readonly int $excludedDetailCount,
        public readonly int $taxableSubtotal,
        public readonly int $nontaxableSubtotal,
    ) {
    }

    public function toArray(): array
    {
        return [
            'net_amount' => $this->netAmount,
            'tax_amount' => $this->taxAmount,
            'total_amount' => $this->totalAmount,
            'total' => $this->totalAmount,
            'excluded_detail_count' => $this->excludedDetailCount,
            // excluded_count は tests/checks.py が使うキー名（openapi.yaml は excluded_detail_count）。
            'excluded_count' => $this->excludedDetailCount,
            'taxable_subtotal' => $this->taxableSubtotal,
            'nontaxable_subtotal' => $this->nontaxableSubtotal,
        ];
    }
}
