<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Hospitalization extends Model
{
    protected $fillable = ['patient_id', 'admitted_on', 'discharged_on', 'room'];

    protected $casts = ['admitted_on' => 'date', 'discharged_on' => 'date'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function careRecords(): HasMany
    {
        return $this->hasMany(CareRecord::class)->orderBy('recorded_at');
    }

    public function isOngoing(): bool
    {
        return $this->discharged_on === null;
    }
}
