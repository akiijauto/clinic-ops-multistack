<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * CareRecord — 入院の記録行。
 *
 * performed_by_staff_id は必須（DBのFKもNOT NULL）。**空の記録行を作らない**
 * （spec/model.md・検算7）。ここを nullable にしない。
 */
class CareRecord extends Model
{
    protected $fillable = ['hospitalization_id', 'recorded_at', 'category', 'content', 'performed_by_staff_id'];

    protected $casts = ['recorded_at' => 'datetime'];

    public function hospitalization(): BelongsTo
    {
        return $this->belongsTo(Hospitalization::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'performed_by_staff_id');
    }
}
