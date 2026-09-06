<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Models\Patient;
use App\Services\BillingCalculator;
use App\Support\ApiError;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 会計履歴（画面15）。契約: spec/openapi.yaml `/animals/{karte_no}/accounting/history`。
 * scope: patient（既定）/ owner / all。
 */
class AccountingHistoryController extends Controller
{
    public function index(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $scope = $request->query('scope', 'patient');
        $query = Billing::query()->with(['patient', 'details']);

        if ($scope === 'owner') {
            $query->where('owner_id', $patient->owner_id);
        } elseif ($scope === 'all') {
            // 全件（この病院は1件だけなので絞り込み無し）
        } else {
            $scope = 'patient';
            $query->where('patient_id', $patient->id);
        }

        $billings = $query->orderByDesc('billed_on')->orderByDesc('id')->get();
        $calc = new BillingCalculator();
        $rows = $billings->map(fn (Billing $b) => [
            'billing' => $b,
            'totals' => $calc->calculate($b),
        ]);

        return view('billing.accounting_history', [
            'patient' => $patient,
            'scope' => $scope,
            'rows' => $rows,
        ]);
    }
}
