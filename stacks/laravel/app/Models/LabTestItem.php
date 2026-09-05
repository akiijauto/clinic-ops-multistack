<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * LabTestItem — 検査の項目値。
 *
 * 基準値・判定は保存しない。App\Services\LabJudgment::judge() で都度計算する
 * （spec/model.md「基準値は固定データから引く。保存しない」）。
 */
class LabTestItem extends Model
{
    protected $fillable = ['lab_test_id', 'item_code', 'value_num', 'value_text'];

    protected $casts = ['value_num' => 'decimal:4'];

    public function labTest(): BelongsTo
    {
        return $this->belongsTo(LabTest::class);
    }
}
