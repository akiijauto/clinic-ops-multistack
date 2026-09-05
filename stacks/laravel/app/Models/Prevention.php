<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prevention extends Model
{
    protected $fillable = ['patient_id', 'kind', 'content', 'performed_date', 'next_due_date'];

    protected $casts = ['performed_date' => 'date', 'next_due_date' => 'date'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
