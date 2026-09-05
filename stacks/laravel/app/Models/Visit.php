<?php

namespace App\Models;

use App\Support\SoftDeletable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Visit — 診察。物理削除しない（spec/model.md）。
 */
class Visit extends Model
{
    use SoftDeletable;

    protected $fillable = [
        'patient_id', 'visit_no', 'visit_date', 'visit_time', 'body_weight_kg',
        'chief_complaint', 'symptom', 'diagnosis', 'treatment', 'staff_id', 'deleted_at',
    ];

    protected $casts = [
        'visit_date' => 'date',
        'body_weight_kg' => 'decimal:2',
        'deleted_at' => 'datetime',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }

    public function progressNotes(): HasMany
    {
        return $this->hasMany(ProgressNote::class)->orderBy('row_no');
    }

    public function labTests(): HasMany
    {
        return $this->hasMany(LabTest::class);
    }


    /** 次の visit_no（患者ごとの連番。spec/openapi.yaml Visit.visit_no は readOnly）。 */
    public static function nextVisitNo(int $patientId): int
    {
        return (int) (static::withoutGlobalScopes()
            ->where('patient_id', $patientId)
            ->max('visit_no')) + 1;
    }
}
