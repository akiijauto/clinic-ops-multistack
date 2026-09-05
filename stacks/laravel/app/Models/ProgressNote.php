<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ProgressNote — 経過記録。
 *
 * temperature_c / pulse / respiration / body_weight_kg は行ごとに違う値になるはず
 * （検算3）。テンプレート側でこのモデルの値をそのまま出すこと。固定値を書かない。
 */
class ProgressNote extends Model
{
    protected $fillable = [
        'visit_id', 'row_no', 'entry_date', 'temperature_c', 'pulse',
        'respiration', 'body_weight_kg', 'symptom_course', 'treatment_rx', 'note',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'temperature_c' => 'decimal:1',
        'body_weight_kg' => 'decimal:2',
    ];

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }
}
