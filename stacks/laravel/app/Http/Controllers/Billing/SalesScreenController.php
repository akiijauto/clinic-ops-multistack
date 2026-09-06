<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Api\SalesSummaryController;
use App\Http\Controllers\Controller;
use App\Models\Staff;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/**
 * 売上集計（新）。契約は spec/openapi.yaml `/sales`、表示要件は spec/screens.md 画面17。
 * 計算は App\Http\Controllers\Api\SalesSummaryController と同じロジックを共有する
 * （画面用とAPI用で別々に計算すると数字が食い違う事故になるため）。
 *
 * 画面17は「分類別・担当別・日別の3つの表」を要求する（同じ元データを3通りに
 * 切っているだけで、3表それぞれの合計はすべて一致する）。以前は分類別の1表しか
 * 出しておらず、レビューで指摘された（2026-09-06）。
 */
class SalesScreenController extends Controller
{
    public function index(Request $request, SalesSummaryController $api): View
    {
        $summary = $api->__invoke($request)->getData(true);

        return view('billing.sales', [
            'summary' => $summary,
            'from' => $request->query('from', ''),
            'to' => $request->query('to', ''),
            'staffNames' => Staff::pluck('name', 'id'),
        ]);
    }
}
