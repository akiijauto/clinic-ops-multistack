<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Services\BillingCalculator;
use Illuminate\Http\JsonResponse;

/**
 * 会計伝票のAPI。契約は spec/openapi.yaml の /api/billings/{id}。
 *
 * 合計・税額・未算入件数は保存しない（Billingモデルの注記どおり）。
 * 都度 BillingCalculator で billing_details から計算する。
 */
class BillingController extends Controller
{
    public function show(Billing $billing): JsonResponse
    {
        $billing->load('details');
        $totals = (new BillingCalculator())->calculate($billing);

        return response()->json([
            'id' => $billing->id,
            'patient_id' => $billing->patient_id,
            'owner_id' => $billing->owner_id,
            'slip_no' => $billing->slip_no,
            'status' => $billing->status,
            'billed_on' => $billing->billed_on->format('Y-m-d'),
            'staff_id' => $billing->staff_id,
            'cashier_staff_id' => $billing->cashier_staff_id,
            'paid_amount' => $billing->paid_amount,
            'payment_method' => $billing->payment_method,
            'details' => $billing->details->map(fn ($d) => [
                'id' => $d->id,
                'billing_id' => $d->billing_id,
                'row_no' => $d->row_no,
                'price_code' => $d->price_code,
                'name' => $d->name,
                'quantity' => (float) $d->quantity,
                'unit_price' => $d->unit_price,
                'is_taxable' => (bool) $d->is_taxable,
                // quantity * unit_price。unit_price が無い行は合計に含めないので null。
                'amount' => $d->hasPrice() ? (int) round($d->quantity * $d->unit_price) : null,
            ])->values(),
        ] + $totals->toArray());
    }
}
