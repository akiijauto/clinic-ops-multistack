<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reception extends Model
{
    protected $fillable = [
        'patient_id', 'display_no', 'received_at', 'owner_purpose',
        'medical_purpose', 'status', 'staff_id',
    ];

    protected $casts = ['received_at' => 'datetime'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}
