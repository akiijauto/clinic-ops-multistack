<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\BillingDetail;
use App\Models\Owner;
use App\Models\Patient;
use App\Services\BillingCalculator;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 会計伝票のAPI。契約は spec/openapi.yaml の
 * `/api/patients/{karte_no}/billings` `/api/owners/{owner_no}/billings`
 * `/api/billings` `/api/billings/{id}`。
 *
 * 合計・税額・未算入件数は保存しない（Billingモデルの注記どおり）。
 * 都度 BillingCalculator で billing_details から計算する。画面側
 * （Billing\AccountingController）と確定時の伝票番号採番ルールを合わせている。
 */
class BillingController extends Controller
{
    public function indexForPatient(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return $this->paginated($request, Billing::where('patient_id', $patient->id));
    }

    public function indexForOwner(Request $request, string $ownerNo): JsonResponse
    {
        $owner = Owner::where('owner_no', $ownerNo)->first();
        if ($owner === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return $this->paginated($request, Billing::where('owner_id', $owner->id));
    }

    public function index(Request $request): JsonResponse
    {
        $query = Billing::query();
        if ($from = $request->query('from')) {
            $query->where('billed_on', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('billed_on', '<=', $to);
        }

        return $this->paginated($request, $query);
    }

    private function paginated(Request $request, $query): JsonResponse
    {
        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);

        $total = (clone $query)->count();
        $items = $query->with('details')->orderByDesc('billed_on')->orderByDesc('id')->skip($offset)->take($limit)->get();

        return response()->json(['items' => $items->map(fn ($b) => self::plain($b))->values(), 'total' => $total]);
    }

    public function storeForPatient(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $billedOn = $request->input('billed_on');
        if (! $billedOn) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'billed_on', 'message' => '会計日は必須です。'],
            ]);
        }

        $billing = DB::transaction(function () use ($request, $patient, $billedOn) {
            $billing = Billing::create([
                'patient_id' => $patient->id,
                'owner_id' => $patient->owner_id,
                'slip_no' => null,
                'status' => 'draft',
                'billed_on' => $billedOn,
                'staff_id' => $request->input('staff_id'),
                'cashier_staff_id' => $request->input('cashier_staff_id'),
                'paid_amount' => $request->input('paid_amount'),
                'payment_method' => $request->input('payment_method'),
            ]);

            $this->replaceDetails($billing, (array) $request->input('details', []));

            if ($request->input('status') === 'confirmed') {
                $this->confirm($billing);
            }

            return $billing;
        });

        return response()->json(self::plain($billing->fresh('details')), 201);
    }

    public function show(Billing $billing): JsonResponse
    {
        $billing->load('details');

        return response()->json(self::plain($billing));
    }

    public function update(Request $request, Billing $billing): JsonResponse
    {
        $wasConfirmed = $billing->status === 'confirmed';

        DB::transaction(function () use ($request, $billing, $wasConfirmed) {
            $billing->fill($request->only([
                'billed_on', 'staff_id', 'cashier_staff_id', 'paid_amount', 'payment_method',
            ]))->save();

            // 確定済みの伝票は明細を変更しない（Billing\AccountingController と同じ規則）。
            if (! $wasConfirmed && $request->has('details')) {
                $this->replaceDetails($billing, (array) $request->input('details', []));
            }

            if (! $wasConfirmed && $request->input('status') === 'confirmed') {
                $this->confirm($billing);
            }
        });

        return response()->json(self::plain($billing->fresh('details')));
    }

    private function replaceDetails(Billing $billing, array $rows): void
    {
        $billing->details()->delete();
        $rowNo = 1;
        foreach ($rows as $row) {
            BillingDetail::create([
                'billing_id' => $billing->id,
                'row_no' => $row['row_no'] ?? $rowNo,
                'price_code' => $row['price_code'],
                'name' => $row['name'],
                'quantity' => $row['quantity'],
                'unit_price' => $row['unit_price'] ?? null,
                'is_taxable' => (bool) ($row['is_taxable'] ?? false),
            ]);
            $rowNo++;
        }
    }

    /** 確定処理。伝票番号の採番規則は Billing\AccountingController::confirm と同じ。 */
    private function confirm(Billing $billing): void
    {
        $nextSeq = (int) Billing::where('slip_no', 'like', 'B-'.$billing->billed_on->format('Ymd').'-%')->count() + 1;
        $billing->update([
            'status' => 'confirmed',
            'slip_no' => sprintf('B-%s-%04d', $billing->billed_on->format('Ymd'), $nextSeq),
        ]);
    }

    public static function plain(Billing $billing): array
    {
        $totals = (new BillingCalculator())->calculate($billing);

        return [
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
        ] + $totals->toArray();
    }
}
