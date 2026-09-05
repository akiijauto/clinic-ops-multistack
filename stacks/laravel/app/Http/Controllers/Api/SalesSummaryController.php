<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Services\LargestRemainder;
use App\Support\FixedData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 売上集計API。契約は spec/openapi.yaml の /api/sales/summary、
 * 集計規則は spec/acceptance.md「検算1：売上の3方向一致」。
 *
 * - 対象は Billing.status = confirmed のみ（draft は除外）。
 * - unit_price 未設定の明細は、どの合計・構成比からも除外する（検算2）。
 * - 分類・担当・日別の内訳を全部足すと、総合計と完全に一致する（検算1）。
 * - 消費税は按分しない。この集計は税抜売上のみを扱う（acceptance.md）。
 */
class SalesSummaryController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = Billing::with('details')->where('status', 'confirmed');
        if ($from = $request->query('from')) {
            $query->where('billed_on', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('billed_on', '<=', $to);
        }
        $billings = $query->get();

        $byCategory = [];
        $byStaff = [];
        $byDate = [];
        $total = 0;
        $excludedTotal = 0;

        foreach ($billings as $billing) {
            $day = $billing->billed_on->format('Y-m-d');

            foreach ($billing->details as $detail) {
                if (! $detail->hasPrice()) {
                    // unit_price 未設定。0円として合計に入れず、件数だけ数える（検算2）。
                    $excludedTotal++;

                    continue;
                }

                $amount = (int) round($detail->quantity * $detail->unit_price);
                $total += $amount;
                $byDate[$day] = ($byDate[$day] ?? 0) + $amount;
                $byStaff[$billing->staff_id] = ($byStaff[$billing->staff_id] ?? 0) + $amount;

                $item = FixedData::priceItem($detail->price_code);
                $category = $item['category_major'] ?? $item['category'] ?? null;
                if ($category !== null) {
                    $byCategory[$category] = ($byCategory[$category] ?? 0) + $amount;
                }
            }
        }

        // 構成比は最大剰余法で丸め、合計が厳密に100.0になるようにする（acceptance.md）。
        $shares = LargestRemainder::shares($byCategory);

        return response()->json([
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'group_by' => $request->query('group_by', 'day'),
            // total / total_net_amount は同じ値。呼び出し側の期待するキー名の違いを両対応する。
            'total' => $total,
            'total_net_amount' => $total,
            'total_amount' => $total,
            'excluded_detail_count_total' => $excludedTotal,
            'by_category' => collect($byCategory)->map(fn ($amount, $category) => [
                'category' => $category,
                'net_amount' => $amount,
                'share_pct' => $shares[$category] ?? 0.0,
            ])->values(),
            'by_staff' => collect($byStaff)->map(fn ($amount, $staffId) => [
                'staff_id' => $staffId === null ? null : (int) $staffId,
                'net_amount' => $amount,
            ])->values(),
            'by_date' => collect($byDate)->map(fn ($amount, $date) => [
                'period' => $date,
                'date' => $date,
                'net_amount' => $amount,
            ])->values(),
        ]);
    }
}
