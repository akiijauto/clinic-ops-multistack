<?php

namespace App\Support;

/**
 * Owner / Patient / Visit 共通の「消さずに印を付ける」規則（spec/model.md）。
 *
 * Laravel標準の SoftDeletes は使わない（Owner.php にコメントした理由と同じ：
 * 既定のクエリから常に除外されると、集計側でうっかり漏らす事故につながる）。
 * 代わりに、この trait が「一覧用に既定で隠す」「集計用に必ず全件」の2つの
 * クエリスコープを明示的に提供する。呼び出し側にどちらを使っているかを
 * 常に意識させるのが狙い。
 *
 * 使い方:
 *   Patient::visible()->get();       // 削除済みを除いた一覧（既定表示）
 *   Patient::query()->get();         // 全件（集計・実績用。deleted_at は無視する）
 *   Patient::onlyDeleted()->get();   // 削除済みだけ
 *
 * 削除は softDelete() で行う。物理削除（delete）はこのtraitからは提供しない。
 */
trait SoftDeletable
{
    public function scopeVisible($query)
    {
        return $query->whereNull('deleted_at');
    }

    public function scopeOnlyDeleted($query)
    {
        return $query->whereNotNull('deleted_at');
    }

    public function softDelete(): void
    {
        $this->forceFill(['deleted_at' => now()])->save();
    }

    public function restore(): void
    {
        $this->forceFill(['deleted_at' => null])->save();
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }
}
