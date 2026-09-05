<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Paper extends Model
{
    protected $fillable = ['patient_id', 'title', 'note'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
