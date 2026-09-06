<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * この業務が言う「本日」。
 *
 * 【2026-09-06 裁定で壁時計へ変更】以前はここを`data/seed.json`の`anchor_date`
 * （種データ生成の基準日）に固定していた。理由は「実際の壁時計で判定すると、
 * 種データの当日分がアンカー日以外に開いた瞬間ぜんぶ0件に見える」という実測だった。
 *
 * しかし他4実装（Go/Rails/FastAPI/Next.js）はすべて壁時計を使っており、
 * このレーンだけアンカー日固定だったため、同時刻に`/today`を叩くとこのレーンだけ
 * 25件・他は0件という食い違いが実測された（指揮役・レビュー役の指摘）。
 * `anchor_date`は「データ生成の基準日」であって「いまが何日か」ではない
 * （`data/README.md`）。5実装の一致を優先し、壁時計に統一する。
 *
 * 種データの当日分が壁時計の日付では0件に見えるのは、
 * **その通りの状態を正しく表示している**だけであり、そのこと自体は不具合ではない
 * （coordination/qa/lane-c.md参照）。
 */
final class BusinessClock
{
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now('Asia/Tokyo')->startOfDay();
    }

    public static function todayString(): string
    {
        return self::today()->toDateString();
    }
}
