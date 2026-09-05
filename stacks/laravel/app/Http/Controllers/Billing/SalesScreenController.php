<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Api\SalesSummaryController;
use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/**
 * 売上集計（新）。契約は spec/openapi.yaml `/sales`。
 * 計算は App\Http\Controllers\Api\SalesSummaryController と同じロジックを共有する
 * （画面用とAPI用で別々に計算すると数字が食い違う事故になるため）。
 */
class SalesScreenController extends Controller
{
    public function index(Request $request, SalesSummaryController $api): View
    {
        $summary = $api->__invoke($request)->getData(true);

        return view('billing.sales', ['summary' => $summary]);
    }
}
