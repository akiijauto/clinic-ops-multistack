<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\BillingDetail;
use App\Models\Patient;
use App\Services\BillingCalculator;
use App\Support\ApiError;
use App\Support\BusinessClock;
use App\Support\CurrentStaff;
use App\Support\FixedData;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 会計（画面14）。契約: spec/openapi.yaml `/animals/{karte_no}/accounting`。
 *
 * status=confirmed の伝票は明細の追加・複写・削除・全削除がいずれも失敗する
 * （spec/screens.md画面14「満たすべきこと」）。
 */
class AccountingController extends Controller
{
    public function show(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $billing = $this->resolveBilling($request, $patient);

        return $this->render($patient, $billing);
    }

    /** 過去の伝票（?slip=billing.id）が無ければ、当日のdraftを開くか新規に作る。 */
    private function resolveBilling(Request $request, Patient $patient): Billing
    {
        $slipId = $request->query('slip');
        if ($slipId) {
            $existing = Billing::where('patient_id', $patient->id)->where('id', $slipId)->first();
            if ($existing) {
                return $existing;
            }
        }

        $today = BusinessClock::todayString();
        $draft = Billing::where('patient_id', $patient->id)
            ->where('status', 'draft')
            ->whereDate('billed_on', $today)
            ->first();
        if ($draft) {
            return $draft;
        }

        return Billing::create([
            'patient_id' => $patient->id,
            'owner_id' => $patient->owner_id,
            'slip_no' => null, // 確定時に採番（未確定はnull。spec/screens.md画面14）
            'status' => 'draft',
            'billed_on' => $today,
            'staff_id' => CurrentStaff::id(),
        ]);
    }

    public function addDetail(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $billing = $this->resolveBilling($request, $patient);

        if ($billing->status === 'confirmed') {
            return $this->render($patient, $billing, '確定済みの伝票は変更できません。');
        }

        $priceCode = (string) $request->input('price_code');
        $item = FixedData::priceItem($priceCode);
        if ($item === null) {
            return $this->render($patient, $billing, '指定した料金項目が見つかりません。');
        }

        $quantity = (float) $request->input('quantity', 1);
        if ($quantity <= 0) {
            $quantity = 1;
        }

        $nextRowNo = (int) ($billing->details()->max('row_no') ?? 0) + 1;
        BillingDetail::create([
            'billing_id' => $billing->id,
            'row_no' => $nextRowNo,
            'price_code' => $item['price_code'],
            'name' => $item['name'],
            'quantity' => $quantity,
            'unit_price' => $item['unit_price'],
            'is_taxable' => $item['is_taxable'],
        ]);

        return $this->render($patient, $billing->fresh(), null, '明細を追加しました。');
    }

    public function removeDetail(string $karteNo, int $detailId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $detail = BillingDetail::find($detailId);
        if ($detail === null || $detail->billing->patient_id !== $patient->id) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $billing = $detail->billing;

        if ($billing->status === 'confirmed') {
            return $this->render($patient, $billing, '確定済みの伝票は変更できません。');
        }

        $detail->delete();

        return $this->render($patient, $billing->fresh(), null, '明細を削除しました。');
    }

    public function clearDetails(string $karteNo, int $billingId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $billing = Billing::where('patient_id', $patient->id)->where('id', $billingId)->first();
        if ($billing === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        if ($billing->status === 'confirmed') {
            return $this->render($patient, $billing, '確定済みの伝票は変更できません。');
        }

        $billing->details()->delete();

        return $this->render($patient, $billing->fresh(), null, '明細をすべて削除しました。');
    }

    public function confirm(string $karteNo, int $billingId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $billing = Billing::where('patient_id', $patient->id)->where('id', $billingId)->first();
        if ($billing === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        if ($billing->status === 'confirmed') {
            return $this->render($patient, $billing, '既に確定済みです。');
        }
        if ($billing->details()->count() === 0) {
            return $this->render($patient, $billing, '明細が1行も無い伝票は確定できません。');
        }

        DB::transaction(function () use ($billing) {
            $nextSeq = (int) Billing::where('slip_no', 'like', 'B-'.$billing->billed_on->format('Ymd').'-%')->count() + 1;
            $billing->update([
                'status' => 'confirmed',
                'slip_no' => sprintf('B-%s-%04d', $billing->billed_on->format('Ymd'), $nextSeq),
            ]);
        });

        return $this->render($patient, $billing->fresh(), null, '確定しました。伝票番号: '.$billing->slip_no);
    }

    private function render(Patient $patient, Billing $billing, ?string $error = null, ?string $success = null): View
    {
        $billing->load('details');
        $totals = (new BillingCalculator())->calculate($billing);

        return view('billing.accounting', [
            'patient' => $patient,
            'billing' => $billing,
            'totals' => $totals,
            'priceCategories' => collect(FixedData::priceItems())->groupBy('category_major'),
            'error' => $error,
            'success' => $success,
        ]);
    }
}
