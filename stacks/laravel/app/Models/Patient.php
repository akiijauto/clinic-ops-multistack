<?php

namespace App\Models;

use App\Support\SoftDeletable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Patient — 動物。物理削除しない（Owner.php のコメントと同じ理由）。
 */
class Patient extends Model
{
    use SoftDeletable;

    protected $fillable = [
        'karte_no', 'owner_id', 'name_kana', 'name_kanji', 'species', 'breed',
        'sex', 'birth_date', 'neuter_date', 'no_paper', 'deleted_at',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'neuter_date' => 'date',
        'no_paper' => 'boolean',
        'deleted_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function receptions(): HasMany
    {
        return $this->hasMany(Reception::class);
    }

    public function billings(): HasMany
    {
        return $this->hasMany(Billing::class);
    }

}
