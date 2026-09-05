<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BillingDetail — 会計の明細。
 *
 * unit_price が null の行は、金額の合計に**0円として含めてはならない**
 * （spec/model.md・検算2）。App\Services\BillingCalculator が絶対にこの規則を守る。
 */
class BillingDetail extends Model
{
    protected $fillable = ['billing_id', 'row_no', 'price_code', 'name', 'quantity', 'unit_price', 'is_taxable'];

    protected $casts = [
        'quantity' => 'decimal:2',
        'is_taxable' => 'boolean',
    ];

    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class);
    }

    public function hasPrice(): bool
    {
        return $this->unit_price !== null;
    }
}
