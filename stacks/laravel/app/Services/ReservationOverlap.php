<?php

namespace App\Services;

use App\Models\Reservation;
use Carbon\Carbon;

/**
 * 予約の重なり判定。spec/acceptance.md 検算6。
 *
 * 半開区間として扱う：starts_at1 < ends_at2 かつ starts_at2 < ends_at1 のとき重なる。
 * 片方の終了時刻ともう片方の開始時刻がちょうど一致するのは重なりに含めない
 * （10:00–10:30 の次に 10:30–11:00 を予約できる）。
 *
 * status = cancelled の予約は対象外。
 */
final class ReservationOverlap
{
    /**
     * 新規（または変更後）の予約が、同じ担当・同じ処置室の既存予約と重なるかを調べる。
     *
     * @param  int|null  $excludeId  変更時は自分自身のIDを除外する
     */
    public static function conflicts(
        int $staffId,
        string $room,
        Carbon $startsAt,
        Carbon $endsAt,
        ?int $excludeId = null,
    ): bool {
        $query = Reservation::query()
            ->where('status', 'booked')
            ->where(function ($q) use ($staffId, $room) {
                $q->where('staff_id', $staffId)->orWhere('room', $room);
            })
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
