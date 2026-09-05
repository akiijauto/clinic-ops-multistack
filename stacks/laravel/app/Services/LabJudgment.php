<?php

namespace App\Services;

use App\Support\FixedData;

/**
 * 検査値の判定。spec/acceptance.md 検算5。
 *
 * - min ≦ value ≦ max のとき「範囲内」（両端を含む）
 * - value < min なら低値（L）、value > max なら高値（H）
 * - 基準値が定義されていない組み合わせは対象外（'unknown'）
 * - species は dog/cat 以外は other 扱い、sex は unknown は any 扱い（data/lab_items.json）
 */
final class LabJudgment
{
    public function __construct(
        public readonly ?float $referenceLow,
        public readonly ?float $referenceHigh,
        /** 'low' | 'normal' | 'high' | 'unknown' */
        public readonly string $judgement,
        public readonly bool $outOfRange,
    ) {
    }

    /** data-check-flag の値。'normal' | 'high' | 'low'。unknown のときは normal 扱いにしない呼び出し側で判定すること。 */
    public function flag(): string
    {
        return match ($this->judgement) {
            'low' => 'low',
            'high' => 'high',
            default => 'normal',
        };
    }

    /** 画面の判定欄に出す文字。空 / H / L。 */
    public function label(): string
    {
        return match ($this->judgement) {
            'low' => 'L',
            'high' => 'H',
            default => '', // normal / unknown はどちらも空文字
        };
    }

    public static function judge(string $itemCode, ?float $valueNum, string $species, string $sex): self
    {
        if ($valueNum === null) {
            return new self(null, null, 'unknown', false);
        }

        $item = FixedData::labItem($itemCode);
        if ($item === null) {
            return new self(null, null, 'unknown', false);
        }

        $speciesKey = in_array($species, ['dog', 'cat'], true) ? $species : 'other';
        $sexKey = in_array($sex, ['male', 'female'], true) ? $sex : 'any';

        $range = self::findRange($item['reference_ranges'], $speciesKey, $sexKey);
        if ($range === null) {
            return new self(null, null, 'unknown', false);
        }

        $low = (float) $range['low'];
        $high = (float) $range['high'];

        if ($valueNum < $low) {
            return new self($low, $high, 'low', true);
        }
        if ($valueNum > $high) {
            return new self($low, $high, 'high', true);
        }

        return new self($low, $high, 'normal', false);
    }

    private static function findRange(array $ranges, string $species, string $sex): ?array
    {
        // 完全一致（species・sex とも一致）を優先し、'any' 側へ段階的にゆるめる。
        $candidates = [
            [$species, $sex],
            [$species, 'any'],
            ['other', $sex],
            ['other', 'any'],
        ];

        foreach ($candidates as [$sp, $sx]) {
            foreach ($ranges as $r) {
                if ($r['species'] === $sp && $r['sex'] === $sx) {
                    return $r;
                }
            }
        }

        return null;
    }
}
