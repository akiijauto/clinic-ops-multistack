<?php

namespace App\Services;

/**
 * 構成比の丸め（最大剰余法）。spec/acceptance.md「構成比の丸め」。
 *
 * 各分類の素の構成比を小数第1位で切り捨てたあと、100.0に足りない分（0.1刻み）を
 * 剰余が大きい順に配る。合計が必ず厳密に100.0になる。
 */
final class LargestRemainder
{
    /**
     * @param  array<string,float>  $amounts  分類名 => 税抜合計（丸めていない値）
     * @return array<string,float>  分類名 => 構成比（小数第1位、合計=100.0。$amounts が空か合計0なら空配列）
     */
    public static function shares(array $amounts): array
    {
        $total = array_sum($amounts);
        if ($total <= 0 || count($amounts) === 0) {
            return [];
        }

        $raw = [];
        $floor = [];
        $remainder = [];
        foreach ($amounts as $key => $amount) {
            $r = $amount / $total * 100;
            $raw[$key] = $r;
            $floor[$key] = floor($r * 10) / 10; // 小数第1位で切り捨て
            $remainder[$key] = $r - $floor[$key];
        }

        // 100.0 に足りない0.1刻みの件数。浮動小数の誤差を避けるため四捨五入してから整数化する。
        $totalFloor = array_sum($floor);
        $deficitUnits = (int) round((100.0 - $totalFloor) * 10);

        // 剰余が大きい順（同点は元の並び順を保つよう安定ソート）に0.1ずつ配る。
        $keys = array_keys($amounts);
        usort($keys, function ($a, $b) use ($remainder, $keys) {
            $cmp = $remainder[$b] <=> $remainder[$a];
            if ($cmp !== 0) {
                return $cmp;
            }

            return array_search($a, $keys) <=> array_search($b, $keys);
        });

        $result = $floor;
        for ($i = 0; $i < $deficitUnits && $i < count($keys); $i++) {
            $result[$keys[$i]] = round($result[$keys[$i]] + 0.1, 1);
        }

        // 桁落ちの掃除（0.1刻みの加算で 30.099999999999998 のような値になることがある）。
        foreach ($result as $key => $value) {
            $result[$key] = round($value, 1);
        }

        return $result;
    }
}
