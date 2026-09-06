<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\LabTest;
use App\Models\LabTestItem;
use App\Models\Patient;
use App\Services\LabJudgment;
use App\Support\ApiError;
use App\Support\BusinessClock;
use App\Support\CurrentStaff;
use App\Support\FixedData;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 検査（画面10）。契約: spec/openapi.yaml `/animals/{karte_no}/exam`。
 * 基準値・判定は保存しない。App\Services\LabJudgment で都度計算する。
 */
class ExamController extends Controller
{
    public function show(string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $tests = LabTest::where('patient_id', $patient->id)
            ->with('items')
            ->orderByDesc('tested_on')
            ->get();

        return view('clinical.exam', [
            'patient' => $patient,
            'tests' => $tests,
            'labItems' => FixedData::labItems(),
        ]);
    }

    public function store(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $visit = $patient->visits()->orderByDesc('visit_date')->orderByDesc('visit_no')->first();
        if ($visit === null) {
            return view('clinical.exam', [
                'patient' => $patient,
                'tests' => LabTest::where('patient_id', $patient->id)->with('items')->orderByDesc('tested_on')->get(),
                'labItems' => FixedData::labItems(),
                'error' => 'この患者にはまだ診察記録がありません。先にカルテを作成してください。',
            ]);
        }

        $test = LabTest::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'category' => (string) $request->input('category', '一般検査'),
            'tested_on' => BusinessClock::todayString(),
            'staff_id' => CurrentStaff::id(),
        ]);

        foreach ((array) $request->input('items', []) as $itemCode => $value) {
            $value = trim((string) $value);
            if ($value === '') {
                continue; // 未入力の項目は保存しない（項目自体は基準値つきで常に表示される）
            }
            LabTestItem::create([
                'lab_test_id' => $test->id,
                'item_code' => $itemCode,
                'value_num' => is_numeric($value) ? (float) $value : null,
                'value_text' => is_numeric($value) ? null : $value,
            ]);
        }

        return view('clinical.exam', [
            'patient' => $patient,
            'tests' => LabTest::where('patient_id', $patient->id)->with('items')->orderByDesc('tested_on')->get(),
            'labItems' => FixedData::labItems(),
            'success' => '検査結果を保存しました。',
        ]);
    }

    public static function judge(LabTestItem $item, Patient $patient): LabJudgment
    {
        return LabJudgment::judge(
            $item->item_code,
            $item->value_num !== null ? (float) $item->value_num : null,
            $patient->species,
            $patient->sex,
        );
    }
}
