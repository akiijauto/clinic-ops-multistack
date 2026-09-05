<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Billing — 会計伝票。
 *
 * 合計金額はここに保存しない（data/README.md）。都度
 * App\Services\BillingCalculator::calculate() で billing_details から計算する。
 */
class Billing extends Model
{
    protected $fillable = [
        'patient_id', 'owner_id', 'slip_no', 'status', 'billed_on',
        'staff_id', 'cashier_staff_id', 'paid_amount', 'payment_method',
    ];

    protected $casts = ['billed_on' => 'date'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'cashier_staff_id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(BillingDetail::class)->orderBy('row_no');
    }
}
