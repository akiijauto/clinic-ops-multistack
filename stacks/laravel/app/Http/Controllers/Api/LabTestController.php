<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabTest;
use App\Models\LabTestItem;
use App\Models\Patient;
use App\Services\LabJudgment;
use App\Support\ApiError;
use App\Support\CurrentStaff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 検査API。契約は spec/openapi.yaml `/api/patients/{karte_no}/lab-tests` `/api/lab-tests/{id}`。
 * 基準値・判定は保存しない。都度 App\Services\LabJudgment で計算する（検算5）。
 */
class LabTestController extends Controller
{
    public function index(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $limit = min(max((int) $request->query('limit', 50), 1), 200);
        $offset = max((int) $request->query('offset', 0), 0);

        $query = LabTest::where('patient_id', $patient->id)->with('items')->orderByDesc('tested_on');
        $total = (clone $query)->count();
        $items = $query->skip($offset)->take($limit)->get();

        return response()->json([
            'items' => $items->map(fn ($t) => self::plain($t, $patient))->values(),
            'total' => $total,
        ]);
    }

    public function store(Request $request, string $karteNo): JsonResponse
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit = $patient->visits()->where('id', $request->input('visit_id'))->first();
        if ($visit === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $items = (array) $request->input('items', []);
        if ($items === []) {
            return ApiError::response(ApiError::INVALID_INPUT, [
                ['field' => 'items', 'message' => '1件以上の検査項目が必要です。'],
            ]);
        }

        $test = LabTest::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'category' => (string) $request->input('category', '一般検査'),
            'tested_on' => $request->input('tested_on') ?: now()->toDateString(),
            'tested_at_time' => $request->input('tested_at_time'),
            'staff_id' => $request->input('staff_id', CurrentStaff::id()),
        ]);

        foreach ($items as $row) {
            LabTestItem::create([
                'lab_test_id' => $test->id,
                'item_code' => $row['item_code'],
                'value_num' => $row['value_num'] ?? null,
                'value_text' => $row['value_text'] ?? null,
            ]);
        }

        return response()->json(self::plain($test->fresh('items'), $patient), 201);
    }

    public function show(LabTest $labTest): JsonResponse
    {
        $labTest->load(['items', 'patient']);

        return response()->json(self::plain($labTest, $labTest->patient));
    }

    public static function plain(LabTest $labTest, Patient $patient): array
    {
        return [
            'id' => $labTest->id,
            'patient_id' => $labTest->patient_id,
            'visit_id' => $labTest->visit_id,
            'category' => $labTest->category,
            'tested_on' => $labTest->tested_on->format('Y-m-d'),
            'tested_at_time' => $labTest->tested_at_time,
            'staff_id' => $labTest->staff_id,
            'items' => $labTest->items->map(function ($item) use ($patient) {
                $valueNum = $item->value_num !== null ? (float) $item->value_num : null;
                $j = LabJudgment::judge($item->item_code, $valueNum, $patient->species, $patient->sex);

                return [
                    'id' => $item->id,
                    'lab_test_id' => $item->lab_test_id,
                    'item_code' => $item->item_code,
                    'value_num' => $valueNum,
                    'value_text' => $item->value_text,
                    'reference_low' => $j->referenceLow,
                    'reference_high' => $j->referenceHigh,
                    'judgement' => $j->judgement,
                    'out_of_range' => $j->outOfRange,
                    // judgment（'e'無し）は tests/checks.py が読むキー名。空 / H / L。
                    'judgment' => $j->label(),
                ];
            })->values(),
        ];
    }
}
