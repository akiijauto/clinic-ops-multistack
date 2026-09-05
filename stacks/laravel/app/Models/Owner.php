<?php

namespace App\Models;

use App\Support\SoftDeletable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Owner — 飼主。物理削除しない（spec/model.md）。deleted_at に日時を入れるだけ。
 *
 * Laravel標準の SoftDeletes トレイトは使わない。標準のそれは
 * 「既定のクエリから常に除外し、withTrashed() で明示的に含める」設計だが、
 * この契約は逆に「集計・実績には常に含まれる」ことを要求する場面が多い
 * （検算9）。一覧表示側で deleted_at を明示的に絞り込む方式に統一し、
 * 「うっかり既定スコープに巻き込まれて集計から漏れる」事故を避ける。
 */
class Owner extends Model
{
    use SoftDeletable;

    protected $fillable = [
        'owner_no', 'name_kana', 'name_kanji', 'postal_code',
        'address1', 'address2', 'phone', 'mobile', 'deleted_at',
    ];

    protected $casts = ['deleted_at' => 'datetime'];

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

}
