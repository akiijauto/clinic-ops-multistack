<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * この業務が言う「本日」。
 *
 * data/make_data.py は `datetime.now()` を使わず、常に `ANCHOR_DATE = 2026-09-01`
 * を基準にデータを作っている（data/README.md「日付計算はすべて ANCHOR_DATE を基準にする」）。
 * 画面側が実際の壁時計（`now()`）で「本日」を判定すると、種データの当日分
 * （本日の患者25件など）が、アンカー日以外に動かした瞬間ぜんぶ0件に見えてしまう
 * （2026-09-06 実測：実際の日付で /today を開くと 0 件だった）。
 *
 * 「本日」は常にアンカー日として扱う。これは種データとの整合のためであり、
 * ユーザーが新しく作った受付・診察はアンカー日付で保存すること
 * （各コントローラの保存処理も BusinessClock::today() を使う）。
 */
final class BusinessClock
{
    public static function today(): CarbonImmutable
    {
        $anchor = FixedData::seed()['anchor_date'];

        return CarbonImmutable::parse($anchor, 'Asia/Tokyo')->startOfDay();
    }

    public static function todayString(): string
    {
        return self::today()->toDateString();
    }
}
