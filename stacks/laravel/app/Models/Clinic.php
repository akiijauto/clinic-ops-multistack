<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Clinic — 病院。1件だけ存在する（spec/model.md）。
 */
class Clinic extends Model
{
    protected $fillable = [
        'name', 'postal_code', 'address1', 'address2', 'phone', 'fax',
        'director_name', 'reservation_slot_minutes', 'tax_rate', 'closed_weekdays',
    ];

    protected $casts = [
        'closed_weekdays' => 'array',
        'tax_rate' => 'decimal:2',
        'reservation_slot_minutes' => 'integer',
    ];

    /** 1件だけの前提。無ければ作らない（seeder が必ず1件作る）。 */
    public static function current(): self
    {
        return static::query()->firstOrFail();
    }
}
