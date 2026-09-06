<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Prevention;
use App\Models\Patient;
use App\Support\ApiError;
use App\Support\FixedData;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 予防（画面12）。契約: spec/openapi.yaml `/animals/{karte_no}/prevention/{kind_id}`。
 * kind_id は data/masters.json の prevention_kinds 配列の添字（0始まり）。
 *
 * 【仮決め】「種別ごとの基本周期」は data/masters.json に無い（次回予定日の自動計算に
 * 使う周期は定義されていない）。次回予定日の自動計算は行わず、空なら空のまま保存する
 * （screens.md「周期が未設定なら次回予定日は空のまま保存される」に該当する扱い）。
 * coordination/qa/lane-c.md に記録する。
 */
class PreventionController extends Controller
{
    private function kindCode(int $kindId): ?string
    {
        return FixedData::master('prevention_kinds')[$kindId]['code'] ?? null;
    }

    public function show(string $karteNo, int $kindId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $code = $this->kindCode($kindId);
        if ($patient === null || $code === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $rows = Prevention::where('patient_id', $patient->id)->where('kind', $code)->orderByDesc('performed_date')->get();

        return view('clinical.prevention', [
            'patient' => $patient,
            'kindId' => $kindId,
            'kindName' => FixedData::master('prevention_kinds')[$kindId]['name'],
            'rows' => $rows,
        ]);
    }

    public function store(Request $request, string $karteNo, int $kindId): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        $code = $this->kindCode($kindId);
        if ($patient === null || $code === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $performedDate = $request->input('performed_date');
        if (! $performedDate) {
            return $this->render($patient, $kindId, '実施日は必須です。');
        }

        // 次回予定日：入力値があればそれを優先。無ければ空のまま（基本周期の定義が無いため）。
        $nextDue = $request->input('next_due_date') ?: null;

        Prevention::create([
            'patient_id' => $patient->id,
            'kind' => $code,
            'content' => $request->input('content'),
            'performed_date' => $performedDate,
            'next_due_date' => $nextDue,
        ]);

        return $this->render($patient, $kindId, null, '保存しました。');
    }

    private function render(Patient $patient, int $kindId, ?string $error = null, ?string $success = null): View
    {
        $code = $this->kindCode($kindId);
        $rows = Prevention::where('patient_id', $patient->id)->where('kind', $code)->orderByDesc('performed_date')->get();

        return view('clinical.prevention', [
            'patient' => $patient,
            'kindId' => $kindId,
            'kindName' => FixedData::master('prevention_kinds')[$kindId]['name'],
            'rows' => $rows,
            'error' => $error,
            'success' => $success,
        ]);
    }
}
