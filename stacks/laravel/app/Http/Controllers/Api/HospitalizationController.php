<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hospitalization;
use Illuminate\Http\JsonResponse;

/**
 * 入院APIの表示。契約は spec/openapi.yaml `/api/hospitalizations/{id}/care-records`。
 * 実施者（performed_by_staff_id）は必須（spec/acceptance.md 検算7）。DBのFKもNOT NULLなので、
 * 保存されている行に空のものは無いはず——ここは読むだけ。
 */
class HospitalizationController extends Controller
{
    public function careRecords(Hospitalization $hospitalization): JsonResponse
    {
        $items = $hospitalization->careRecords->map(fn ($r) => [
            'id' => $r->id,
            'hospitalization_id' => $r->hospitalization_id,
            'recorded_at' => $r->recorded_at->format('Y-m-d\TH:i:sP'),
            'category' => $r->category,
            'content' => $r->content,
            'performed_by_staff_id' => $r->performed_by_staff_id,
        ])->values();

        return response()->json(['items' => $items, 'total' => $items->count()]);
    }
}
