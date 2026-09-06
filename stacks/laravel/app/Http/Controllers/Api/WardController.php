<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hospitalization;
use App\Support\BusinessClock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 病棟（指定日の入院中患者一覧）のAPI。契約は spec/openapi.yaml `/api/ward`。
 * 画面側（Ops\WardController）と同じ絞り込みを使う。
 */
class WardController extends Controller
{
    public function day(Request $request): JsonResponse
    {
        $date = $request->query('date') ?: BusinessClock::todayString();

        $items = Hospitalization::with('careRecords')
            ->where('admitted_on', '<=', $date)
            ->where(function ($q) use ($date) {
                $q->whereNull('discharged_on')->orWhere('discharged_on', '>=', $date);
            })
            ->get();

        return response()->json([
            'items' => $items->map(fn ($h) => HospitalizationController::plain($h))->values(),
            'total' => $items->count(),
        ]);
    }
}
