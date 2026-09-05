<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabTest;
use App\Services\LabJudgment;
use Illuminate\Http\JsonResponse;

/**
 * 検査APIの表示。契約は spec/openapi.yaml の /api/lab-tests/{id}。
 * 基準値・判定は保存しない。都度 App\Services\LabJudgment で計算する（検算5）。
 */
class LabTestController extends Controller
{
    public function show(LabTest $labTest): JsonResponse
    {
        $labTest->load(['items', 'patient']);
        $patient = $labTest->patient;

        return response()->json([
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
        ]);
    }
}
